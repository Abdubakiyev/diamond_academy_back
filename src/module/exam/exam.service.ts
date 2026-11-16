import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExamType, Prisma, Role, Skill } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { ListExamsQueryDto } from './dto/list-exams-query.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

/** Bo'limlarning tartibi (imtihon shu tartibda o'tadi) */
const SKILL_ORDER: Skill[] = [Skill.LISTENING, Skill.READING, Skill.WRITING, Skill.SPEAKING];

/**
 * To'liq Multilevel uchun boshlang'ich sozlama. Bu qiymatlar RASMIY EMAS — admin istalgan vaqtda
 * PATCH /exam/sections/:id orqali o'zgartira oladi.
 */
const FULL_DEFAULTS: Record<Skill, { title: string; timeLimitSec: number }> = {
  [Skill.LISTENING]: { title: 'Listening', timeLimitSec: 35 * 60 },
  [Skill.READING]: { title: 'Reading', timeLimitSec: 60 * 60 },
  [Skill.WRITING]: { title: 'Writing', timeLimitSec: 60 * 60 },
  [Skill.SPEAKING]: { title: 'Speaking', timeLimitSec: 15 * 60 },
};

@Injectable()
export class ExamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private isStaff(role: Role) {
    return role === Role.ADMIN || role === Role.TEACHER;
  }

  /* ───────────── Yordamchilar ───────────── */

  /** ADMIN hammasini, TEACHER faqat o'zi yaratgan imtihonlarni boshqaradi */
  private assertCanManage(user: AuthUser, createdById: string) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.TEACHER && createdById === user.id) return;
    throw new ForbiddenException('Bu imtihonni boshqarish huquqingiz yo‘q');
  }

  /** Boshqa modullar (part, savol ...) ham ishlatadi: imtihonni topadi va huquqni tekshiradi */
  async getManageableExam(user: AuthUser, examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Imtihon topilmadi');
    this.assertCanManage(user, exam.createdById);
    return exam;
  }

  /** Bo'limni topadi va uning imtihoni bo'yicha huquqni tekshiradi */
  async getManageableSection(user: AuthUser, sectionId: string) {
    const section = await this.prisma.examSection.findUnique({
      where: { id: sectionId },
      include: { exam: { select: { id: true, type: true, createdById: true } } },
    });
    if (!section) throw new NotFoundException('Bo‘lim topilmadi');
    this.assertCanManage(user, section.exam.createdById);
    return section;
  }

  private async assertLevelExists(levelId: string) {
    const level = await this.prisma.level.findUnique({ where: { id: levelId }, select: { id: true } });
    if (!level) throw new NotFoundException('Daraja topilmadi');
  }

  private async hasAttempts(examId: string) {
    return (await this.prisma.examAttempt.count({ where: { examId } })) > 0;
  }

  private isUniqueViolation(e: unknown) {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
  }

  private serialize<T extends { price: Prisma.Decimal }>(exam: T) {
    return { ...exam, price: Number(exam.price), isFree: Number(exam.price) === 0 };
  }

  /** Imtihon (yoki bitta bo'lim) ichidagi barcha storage kalitlari */
  private async collectKeys(sectionWhere: Prisma.ExamSectionWhereInput): Promise<string[]> {
    const [parts, questions, media] = await Promise.all([
      this.prisma.examPart.findMany({
        where: { section: sectionWhere },
        select: { audioKey: true, imageKey: true },
      }),
      this.prisma.question.findMany({
        where: { part: { section: sectionWhere } },
        select: { audioKey: true },
      }),
      this.prisma.questionMedia.findMany({
        where: { question: { part: { section: sectionWhere } } },
        select: { storageKey: true },
      }),
    ]);
    return [
      ...parts.flatMap((p) => [p.audioKey, p.imageKey]),
      ...questions.map((q) => q.audioKey),
      ...media.map((m) => m.storageKey),
    ].filter((k): k is string => !!k);
  }

  /* ───────────── Imtihon CRUD ───────────── */

  async create(user: AuthUser, dto: CreateExamDto) {
    const type = dto.type ?? ExamType.FULL_MULTILEVEL;
    if (dto.levelId) await this.assertLevelExists(dto.levelId);

    let sections: Prisma.ExamSectionCreateWithoutExamInput[];

    if (type === ExamType.FULL_MULTILEVEL) {
      if (dto.durationMinutes !== undefined || (dto.skills && dto.skills.length > 0)) {
        throw new BadRequestException(
          'To‘liq Multilevel imtihonida 4 ta bo‘lim avtomatik yaratiladi. durationMinutes va skills faqat CUSTOM uchun',
        );
      }
      sections = SKILL_ORDER.map((skill, i) => ({
        skill,
        order: i + 1,
        title: FULL_DEFAULTS[skill].title,
        timeLimitSec: FULL_DEFAULTS[skill].timeLimitSec,
      }));
    } else {
      if (dto.durationMinutes === undefined) {
        throw new BadRequestException('CUSTOM test uchun umumiy vaqtni (durationMinutes) kiriting');
      }
      const skills = [...new Set(dto.skills ?? [])].sort((a, b) => SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b));
      sections = skills.map((skill, i) => ({ skill, order: i + 1, title: FULL_DEFAULTS[skill].title }));
    }

    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title.trim(),
        description: dto.description,
        type,
        levelId: dto.levelId,
        price: dto.price ?? 0,
        durationMinutes: type === ExamType.CUSTOM ? dto.durationMinutes : null,
        createdById: user.id,
        sections: { create: sections },
      },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
    return this.serialize(exam);
  }

  async findAll(user: AuthUser, query: ListExamsQueryDto) {
    const staff = this.isStaff(user.role);
    const where: Prisma.ExamWhereInput = {};

    if (query.type) where.type = query.type;
    if (query.levelId) where.levelId = query.levelId;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    if (staff) {
      if (user.role === Role.TEACHER) where.createdById = user.id;
      if (query.published !== undefined) where.isPublished = query.published;
      where.archivedAt = query.archived ? { not: null } : null;
    } else {
      where.isPublished = true;
      where.archivedAt = null;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, items] = await Promise.all([
      this.prisma.exam.count({ where }),
      this.prisma.exam.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          isPublished: true,
          archivedAt: true,
          durationMinutes: true,
          price: true,
          createdAt: true,
          level: { select: { id: true, type: true } },
          sections: {
            orderBy: { order: 'asc' },
            select: { skill: true, order: true, timeLimitSec: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((e) => this.serialize(e)),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(user: AuthUser, id: string) {
    const staff = this.isStaff(user.role);

    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        level: { select: { id: true, type: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            parts: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                order: true,
                title: true,
                format: true,
                timeLimitSec: true,
                _count: { select: { questions: true } },
              },
            },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Imtihon topilmadi');

    if (!staff && (!exam.isPublished || exam.archivedAt)) throw new NotFoundException('Imtihon topilmadi');
    if (staff) this.assertCanManage(user, exam.createdById);

    const sections = exam.sections.map((s) => {
      const questionCount = s.parts.reduce((sum, p) => sum + p._count.questions, 0);
      if (staff) return { ...s, questionCount };
      // Oddiy foydalanuvchiga savollar va part ichidagi ma'lumotlar ko'rsatilmaydi, faqat umumiy tuzilma
      return {
        id: s.id,
        skill: s.skill,
        order: s.order,
        title: s.title,
        timeLimitSec: s.timeLimitSec,
        maxScore: s.maxScore,
        partCount: s.parts.length,
        questionCount,
      };
    });

    const base = this.serialize({ ...exam, sections });
    if (!staff) return base;

    const [attempts, payments] = await Promise.all([
      this.prisma.examAttempt.count({ where: { examId: id } }),
      this.prisma.examPayment.count({ where: { examId: id } }),
    ]);
    return { ...base, stats: { attempts, payments } };
  }

  async update(user: AuthUser, id: string, dto: UpdateExamDto) {
    const exam = await this.getManageableExam(user, id);

    if (dto.durationMinutes !== undefined && exam.type !== ExamType.CUSTOM) {
      throw new BadRequestException('Umumiy vaqt faqat CUSTOM test uchun. Multilevelda bo‘lim vaqtlarini o‘zgartiring');
    }
    if (dto.levelId) await this.assertLevelExists(dto.levelId);

    const updated = await this.prisma.exam.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        levelId: dto.levelId,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
      },
    });
    return this.serialize(updated);
  }

  /* ───────────── E'lon qilish / arxiv ───────────── */

  /** Imtihon foydalanuvchiga ochilishidan oldin tuzilma to'liqligini tekshiradi */
  private async findProblems(examId: string): Promise<string[]> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            parts: {
              orderBy: { order: 'asc' },
              select: {
                order: true,
                title: true,
                audioUrl: true,
                audioKey: true,
                _count: { select: { questions: true } },
              },
            },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Imtihon topilmadi');

    const problems: string[] = [];

    if (exam.type === ExamType.FULL_MULTILEVEL) {
      for (const skill of SKILL_ORDER) {
        if (!exam.sections.some((s) => s.skill === skill)) problems.push(`${skill} bo‘limi yo‘q`);
      }
    } else {
      if (exam.sections.length === 0) problems.push('Kamida bitta bo‘lim qo‘shing');
      const allSectionsTimed = exam.sections.length > 0 && exam.sections.every((s) => s.timeLimitSec);
      if (!exam.durationMinutes && !allSectionsTimed) {
        problems.push('Umumiy vaqt (durationMinutes) yoki har bir bo‘lim vaqti belgilanmagan');
      }
    }

    for (const s of exam.sections) {
      if (s.parts.length === 0) {
        problems.push(`${s.skill}: part yo‘q`);
        continue;
      }
      for (const p of s.parts) {
        const name = `${s.skill} / ${p.title ?? `Part ${p.order}`}`;
        if (p._count.questions === 0) problems.push(`${name}: savol yo‘q`);
        if (s.skill === Skill.LISTENING && !p.audioUrl && !p.audioKey) problems.push(`${name}: audio yuklanmagan`);
      }
    }
    return problems;
  }

  async publish(user: AuthUser, id: string) {
    const exam = await this.getManageableExam(user, id);
    if (exam.archivedAt) throw new BadRequestException('Arxivdagi imtihonni e‘lon qilib bo‘lmaydi. Avval arxivdan chiqaring');

    const problems = await this.findProblems(id);
    if (problems.length > 0) {
      throw new BadRequestException({ message: 'Imtihon hali tayyor emas', problems });
    }

    const updated = await this.prisma.exam.update({ where: { id }, data: { isPublished: true } });
    return this.serialize(updated);
  }

  async unpublish(user: AuthUser, id: string) {
    await this.getManageableExam(user, id);
    const updated = await this.prisma.exam.update({ where: { id }, data: { isPublished: false } });
    return this.serialize(updated);
  }

  /** Arxivlangan imtihon foydalanuvchilarga ko'rinmaydi, lekin natijalar saqlanib qoladi */
  async archive(user: AuthUser, id: string) {
    await this.getManageableExam(user, id);
    const updated = await this.prisma.exam.update({
      where: { id },
      data: { archivedAt: new Date(), isPublished: false },
    });
    return this.serialize(updated);
  }

  /** Arxivdan chiqaradi (qoralama holatida qaytadi, qayta e'lon qilish kerak) */
  async restore(user: AuthUser, id: string) {
    await this.getManageableExam(user, id);
    const updated = await this.prisma.exam.update({ where: { id }, data: { archivedAt: null } });
    return this.serialize(updated);
  }

  /** Urinish yoki to'lov bor bo'lsa o'chirib bo'lmaydi (natijalar saqlanishi uchun), arxivlash kerak */
  async remove(user: AuthUser, id: string) {
    await this.getManageableExam(user, id);

    const [attempts, payments] = await Promise.all([
      this.prisma.examAttempt.count({ where: { examId: id } }),
      this.prisma.examPayment.count({ where: { examId: id } }),
    ]);
    if (attempts > 0 || payments > 0) {
      throw new ConflictException('Bu imtihonda topshirilgan urinishlar yoki to‘lovlar bor. O‘chirish o‘rniga arxivlang');
    }

    const keys = await this.collectKeys({ examId: id });
    await this.prisma.exam.delete({ where: { id } });
    await Promise.allSettled(keys.map((k) => this.storage.remove(k)));
    return { deleted: true };
  }

  /* ───────────── Bo'limlar ───────────── */

  /** Faqat CUSTOM testga: yangi bo'lim qo'shish */
  async addSection(user: AuthUser, examId: string, dto: CreateSectionDto) {
    const exam = await this.getManageableExam(user, examId);
    if (exam.type !== ExamType.CUSTOM) {
      throw new BadRequestException('To‘liq Multilevelda bo‘limlar tayyor (4 ta). Bo‘lim qo‘shish faqat CUSTOM testda');
    }
    if (await this.hasAttempts(examId)) {
      throw new ConflictException('Bu imtihonda urinishlar bor, tuzilmani o‘zgartirib bo‘lmaydi');
    }

    const agg = await this.prisma.examSection.aggregate({ where: { examId }, _max: { order: true } });

    try {
      return await this.prisma.examSection.create({
        data: {
          examId,
          skill: dto.skill,
          order: (agg._max.order ?? 0) + 1,
          title: dto.title?.trim() || FULL_DEFAULTS[dto.skill].title,
          instructions: dto.instructions,
          timeLimitSec: dto.timeLimitSec,
        },
      });
    } catch (e) {
      if (this.isUniqueViolation(e)) throw new ConflictException(`${dto.skill} bo‘limi bu imtihonda allaqachon bor`);
      throw e;
    }
  }

  async updateSection(user: AuthUser, sectionId: string, dto: UpdateSectionDto) {
    await this.getManageableSection(user, sectionId);

    return this.prisma.examSection.update({
      where: { id: sectionId },
      data: {
        title: dto.title === null ? null : dto.title?.trim(),
        instructions: dto.instructions,
        timeLimitSec: dto.timeLimitSec,
        maxScore: dto.maxScore,
      },
    });
  }

  /** Faqat CUSTOM testdan. Bo'lim ichidagi partlar, savollar va fayllar ham o'chadi */
  async removeSection(user: AuthUser, sectionId: string) {
    const section = await this.getManageableSection(user, sectionId);
    if (section.exam.type !== ExamType.CUSTOM) {
      throw new BadRequestException('To‘liq Multilevelning bo‘limlarini o‘chirib bo‘lmaydi');
    }
    if (await this.hasAttempts(section.examId)) {
      throw new ConflictException('Bu imtihonda urinishlar bor, tuzilmani o‘zgartirib bo‘lmaydi');
    }

    const keys = await this.collectKeys({ id: sectionId });
    await this.prisma.examSection.delete({ where: { id: sectionId } });
    await Promise.allSettled(keys.map((k) => this.storage.remove(k)));
    return { deleted: true };
  }
}
