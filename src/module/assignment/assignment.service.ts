import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileKind, Prisma, Role, SubmissionStatus } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CourseService } from '../course/course.service';
import { StorageService } from '../storage/storage.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

const SUBMISSION_KEY_PREFIX = 'submissions/';
const READ_URL_TTL = 6 * 60 * 60;

type FileRow = { id: string; url: string; storageKey: string | null; kind: FileKind; fileName: string | null; sizeBytes: number | null };

@Injectable()
export class AssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CourseService,
    private readonly storage: StorageService,
  ) {}

  private isStaff(role: Role) {
    return role === Role.ADMIN || role === Role.TEACHER;
  }

  /* ───────────── Yordamchilar ───────────── */

  private async getAssignmentOrThrow(id: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        lesson: {
          select: { id: true, title: true, courseId: true, isPublished: true, course: { select: { createdById: true } } },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Vazifa topilmadi');
    return assignment;
  }

  /** ADMIN hammasini, TEACHER faqat o'zi yaratgan kursdagi vazifalarni boshqaradi */
  private assertCanManage(user: AuthUser, createdById: string | null) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.TEACHER && createdById === user.id) return;
    throw new ForbiddenException('Bu kursdagi vazifalarni boshqarish huquqingiz yo‘q');
  }

  /** O'quvchi uchun: dars e'lon qilinganmi va kurs uning guruhiga biriktirilganmi */
  private async assertStudentAccess(user: AuthUser, lesson: { courseId: string; isPublished: boolean }) {
    if (!lesson.isPublished) throw new NotFoundException('Vazifa topilmadi');
    await this.courses.assertCanView(user, lesson.courseId);
  }

  private async fileWithUrl<T extends { url: string; storageKey: string | null }>(f: T): Promise<T> {
    if (!f.storageKey || this.storage.publicUrl(f.storageKey)) return f;
    try {
      return { ...f, url: await this.storage.getReadUrl(f.storageKey, READ_URL_TTL) };
    } catch {
      return f;
    }
  }

  private async withFileUrls<T extends { files: FileRow[] }>(submission: T): Promise<T> {
    return { ...submission, files: await Promise.all(submission.files.map((f) => this.fileWithUrl(f))) };
  }

  private parseDue(value?: string | null): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Muddat sanasi noto‘g‘ri');
    return d;
  }

  /* ───────────── Vazifa CRUD (admin / o'qituvchi) ───────────── */

  async create(user: AuthUser, dto: CreateAssignmentDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
      select: { id: true, course: { select: { createdById: true } } },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    this.assertCanManage(user, lesson.course.createdById);

    const allowText = dto.allowText ?? true;
    const allowFiles = dto.allowFiles ?? true;
    if (!allowText && !allowFiles) {
      throw new BadRequestException('allowText va allowFiles ikkalasi birdan o‘chiq bo‘lishi mumkin emas');
    }

    return this.prisma.assignment.create({
      data: {
        lessonId: dto.lessonId,
        title: dto.title.trim(),
        instructions: dto.instructions.trim(),
        maxScore: dto.maxScore,
        dueDate: this.parseDue(dto.dueDate),
        allowText,
        allowFiles,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateAssignmentDto) {
    const assignment = await this.getAssignmentOrThrow(id);
    this.assertCanManage(user, assignment.lesson.course.createdById);

    const allowText = dto.allowText ?? assignment.allowText;
    const allowFiles = dto.allowFiles ?? assignment.allowFiles;
    if (!allowText && !allowFiles) {
      throw new BadRequestException('allowText va allowFiles ikkalasi birdan o‘chiq bo‘lishi mumkin emas');
    }

    if (dto.maxScore !== undefined && dto.maxScore < assignment.maxScore) {
      const over = await this.prisma.assignmentSubmission.count({
        where: { assignmentId: id, score: { gt: dto.maxScore } },
      });
      if (over > 0) {
        throw new BadRequestException(`${over} ta ishning bahosi yangi maksimal balldan yuqori. Avval ularni qayta baholang`);
      }
    }

    return this.prisma.assignment.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        instructions: dto.instructions?.trim(),
        maxScore: dto.maxScore,
        dueDate: this.parseDue(dto.dueDate),
        allowText: dto.allowText,
        allowFiles: dto.allowFiles,
      },
    });
  }

  /** Diqqat: vazifa o'chsa, o'quvchilar topshirgan ishlar va ularning fayllari ham o'chadi */
  async remove(user: AuthUser, id: string) {
    const assignment = await this.getAssignmentOrThrow(id);
    this.assertCanManage(user, assignment.lesson.course.createdById);

    const files = await this.prisma.submissionFile.findMany({
      where: { submission: { assignmentId: id } },
      select: { storageKey: true },
    });

    await this.prisma.assignment.delete({ where: { id } });
    await Promise.allSettled(files.map((f) => this.storage.remove(f.storageKey)));
    return { deleted: true };
  }

  /* ───────────── Ko'rish ───────────── */

  async findOne(user: AuthUser, id: string) {
    const assignment = await this.getAssignmentOrThrow(id);
    const { lesson, ...data } = assignment;
    const lessonInfo = { id: lesson.id, title: lesson.title, courseId: lesson.courseId };

    if (this.isStaff(user.role)) {
      this.assertCanManage(user, lesson.course.createdById);
      const [total, pending] = await Promise.all([
        this.prisma.assignmentSubmission.count({ where: { assignmentId: id } }),
        this.prisma.assignmentSubmission.count({ where: { assignmentId: id, status: SubmissionStatus.SUBMITTED } }),
      ]);
      return { ...data, lesson: lessonInfo, stats: { total, pending } };
    }

    await this.assertStudentAccess(user, lesson);
    const mine = await this.getMySubmission(user, id, false);
    return { ...data, lesson: lessonInfo, isOverdue: !!data.dueDate && data.dueDate < new Date(), mySubmission: mine };
  }

  /** O'quvchining o'z ishi (yo'q bo'lsa null) */
  async getMySubmission(user: AuthUser, assignmentId: string, checkAccess = true) {
    if (checkAccess) {
      const assignment = await this.getAssignmentOrThrow(assignmentId);
      await this.assertStudentAccess(user, assignment.lesson);
    }
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_userId: { assignmentId, userId: user.id } },
      include: { files: { orderBy: { createdAt: 'asc' } } },
    });
    if (!submission) return null;
    const withUrls = await this.withFileUrls(submission);
    // O'quvchiga storage kalitlari ko'rsatilmaydi
    return { ...withUrls, files: withUrls.files.map(({ storageKey, ...f }) => f) };
  }

  /** Vazifa bo'yicha barcha topshirilgan ishlar (admin / o'qituvchi) */
  async listSubmissions(user: AuthUser, assignmentId: string, query: ListSubmissionsQueryDto) {
    const assignment = await this.getAssignmentOrThrow(assignmentId);
    this.assertCanManage(user, assignment.lesson.course.createdById);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.AssignmentSubmissionWhereInput = {
      assignmentId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.assignmentSubmission.count({ where }),
      this.prisma.assignmentSubmission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          score: true,
          submittedAt: true,
          gradedAt: true,
          user: { select: { id: true, name: true, phone: true } },
          _count: { select: { files: true } },
        },
      }),
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** Bitta ish: egasi yoki tegishli kursning admin / o'qituvchisi ko'ra oladi */
  async getSubmission(user: AuthUser, submissionId: string) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        files: { orderBy: { createdAt: 'asc' } },
        user: { select: { id: true, name: true, phone: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            maxScore: true,
            lesson: { select: { course: { select: { createdById: true } } } },
          },
        },
      },
    });
    if (!submission) throw new NotFoundException('Ish topilmadi');

    const isOwner = submission.userId === user.id;
    if (!isOwner) this.assertCanManage(user, submission.assignment.lesson.course.createdById);

    const withUrls = await this.withFileUrls(submission);
    const { lesson, ...assignment } = withUrls.assignment;
    return {
      ...withUrls,
      assignment,
      files: isOwner && !this.isStaff(user.role) ? withUrls.files.map(({ storageKey, ...f }) => f) : withUrls.files,
    };
  }

  /* ───────────── Topshirish (o'quvchi) ───────────── */

  async submit(user: AuthUser, assignmentId: string, dto: SubmitAssignmentDto) {
    if (this.isStaff(user.role)) {
      throw new ForbiddenException('Vazifani faqat o‘quvchilar topshira oladi');
    }

    const assignment = await this.getAssignmentOrThrow(assignmentId);
    await this.assertStudentAccess(user, assignment.lesson);

    if (assignment.dueDate && assignment.dueDate < new Date()) {
      throw new BadRequestException('Topshirish muddati tugagan');
    }

    const text = dto.text?.trim() || undefined;
    const files = dto.files ?? [];

    if (!text && files.length === 0) throw new BadRequestException('Matn yozing yoki fayl yuklang');
    if (text && !assignment.allowText) throw new BadRequestException('Bu vazifada matn yozish mumkin emas');
    if (files.length > 0 && !assignment.allowFiles) throw new BadRequestException('Bu vazifada fayl yuklash mumkin emas');

    const keys = new Set<string>();
    for (const f of files) {
      if (!f.storageKey.startsWith(SUBMISSION_KEY_PREFIX)) {
        throw new BadRequestException('Fayl kaliti noto‘g‘ri. Avval POST /storage/presign (SUBMISSION_FILE) orqali yuklang');
      }
      if (keys.has(f.storageKey)) throw new BadRequestException('Bir xil fayl ikki marta yuborilgan');
      keys.add(f.storageKey);
    }

    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_userId: { assignmentId, userId: user.id } },
      include: { files: { select: { storageKey: true } } },
    });
    if (existing?.status === SubmissionStatus.GRADED) {
      throw new ConflictException('Ish baholangan, qayta topshirib bo‘lmaydi. O‘qituvchi qaytarsa, qayta yuborishingiz mumkin');
    }

    const fileRows = files.map((f) => ({
      url: this.storage.publicUrl(f.storageKey) ?? f.storageKey,
      storageKey: f.storageKey,
      kind: f.kind ?? FileKind.IMAGE,
      fileName: f.fileName,
      sizeBytes: f.sizeBytes,
    }));

    const result = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.assignmentSubmission.upsert({
        where: { assignmentId_userId: { assignmentId, userId: user.id } },
        create: { assignmentId, userId: user.id, text, status: SubmissionStatus.SUBMITTED },
        update: {
          text: text ?? null,
          status: SubmissionStatus.SUBMITTED,
          score: null,
          feedback: null,
          gradedById: null,
          gradedAt: null,
          submittedAt: new Date(),
        },
      });
      await tx.submissionFile.deleteMany({ where: { submissionId: sub.id } });
      if (fileRows.length > 0) {
        await tx.submissionFile.createMany({ data: fileRows.map((r) => ({ ...r, submissionId: sub.id })) });
      }
      return sub;
    });

    // Almashtirilgan eski fayllarni storage'dan tozalaymiz
    const oldKeys = (existing?.files ?? []).map((f) => f.storageKey).filter((k): k is string => !!k && !keys.has(k));
    await Promise.allSettled(oldKeys.map((k) => this.storage.remove(k)));

    return this.getMySubmission(user, assignmentId, false).then((s) => s ?? { id: result.id });
  }

  /* ───────────── Baholash (admin / o'qituvchi) ───────────── */

  async grade(user: AuthUser, submissionId: string, dto: GradeSubmissionDto) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: { maxScore: true, lesson: { select: { course: { select: { createdById: true } } } } },
        },
      },
    });
    if (!submission) throw new NotFoundException('Ish topilmadi');
    this.assertCanManage(user, submission.assignment.lesson.course.createdById);

    const feedback = dto.feedback?.trim() || null;

    if (dto.returnForRevision) {
      if (!feedback) throw new BadRequestException('Qaytarishda izoh (feedback) yozish shart');
      return this.prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.RETURNED,
          score: null,
          feedback,
          gradedById: user.id,
          gradedAt: new Date(),
        },
        select: { id: true, status: true, score: true, feedback: true, gradedAt: true },
      });
    }

    if (dto.score === undefined) throw new BadRequestException('Ball (score) kiriting');
    if (dto.score > submission.assignment.maxScore) {
      throw new BadRequestException(`Ball ${submission.assignment.maxScore} dan oshmasligi kerak`);
    }

    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.GRADED,
        score: dto.score,
        feedback,
        gradedById: user.id,
        gradedAt: new Date(),
      },
      select: { id: true, status: true, score: true, feedback: true, gradedAt: true },
    });
  }
}
