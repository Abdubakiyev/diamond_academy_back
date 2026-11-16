import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AttemptStatus, ExamType, Prisma, QuestionType, Role, Skill } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AiEvaluationService } from '../ai-evaluation/ai-evaluation.service';
import { ExamAccessService } from '../exam-payment/exam-access.service';
import { ScoringService } from '../scoring/scoring.service';
import { StorageService } from '../storage/storage.service';
import { PlayAudioDto } from './dto/play-audio.dto';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SectionContentService } from './section-content.service';

const SPEAKING_KEY_PREFIX = 'speaking/';
const TFNG = ['TRUE', 'FALSE', 'NOT_GIVEN'];

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class ExamAttemptService implements OnModuleInit {
  private readonly log = new Logger(ExamAttemptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ExamAccessService,
    private readonly scoring: ScoringService,
    private readonly ai: AiEvaluationService,
    private readonly content: SectionContentService,
    private readonly storage: StorageService,
  ) {}

  /** Tarmoq kechikishi uchun qo'shimcha soniyalar (javob saqlash vaqt tugagach ham shu muddat qabul qilinadi) */
  private get graceMs() {
    return Number(process.env.EXAM_GRACE_SEC || 10) * 1000;
  }

  /** Foydalanuvchi tashlab ketgan imtihon necha soatdan keyin avtomatik yakunlanadi */
  private get abandonMs() {
    return Number(process.env.EXAM_ABANDON_HOURS || 6) * 60 * 60 * 1000;
  }

  onModuleInit() {
    if (process.env.EXAM_SWEEPER === 'off') return;
    const timer = setInterval(() => {
      this.sweep().catch((e) => this.log.error(`Tozalash xatosi: ${(e as Error).message}`));
    }, 60_000);
    timer.unref?.();
  }

  /* ───────────── Yordamchilar ───────────── */

  private async getOwnAttempt(user: AuthUser, attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            type: true,
            durationMinutes: true,
            sections: {
              orderBy: { order: 'asc' },
              select: { id: true, skill: true, order: true, title: true, timeLimitSec: true, maxScore: true },
            },
          },
        },
        sections: { select: { id: true, sectionId: true, status: true, startedAt: true, expiresAt: true, finishedAt: true, score: true } },
      },
    });
    if (!attempt || attempt.userId !== user.id) throw new NotFoundException('Urinish topilmadi');
    return attempt;
  }

  private touch(attemptId: string) {
    return this.prisma.examAttempt.update({ where: { id: attemptId }, data: { updatedAt: new Date() } }).catch(() => undefined);
  }

  private remainingSec(expiresAt: Date | null) {
    return expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)) : null;
  }

  private attemptDeadline(attempt: { startedAt: Date; exam: { type: ExamType; durationMinutes: number | null } }) {
    return attempt.exam.type === ExamType.CUSTOM && attempt.exam.durationMinutes
      ? new Date(attempt.startedAt.getTime() + attempt.exam.durationMinutes * 60_000)
      : null;
  }

  /* ───────────── Boshlash ───────────── */

  /** Urinish ochadi. Tugallanmagan urinish bo'lsa, o'shani qaytaradi (yangi to'lov / urinish sarflanmaydi). */
  async start(user: AuthUser, dto: StartAttemptDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
      select: { id: true, isPublished: true, archivedAt: true, _count: { select: { sections: true } } },
    });
    const staff = user.role === Role.ADMIN || user.role === Role.TEACHER;
    if (!exam || (!staff && (!exam.isPublished || exam.archivedAt))) throw new NotFoundException('Imtihon topilmadi');
    if (exam._count.sections === 0) throw new BadRequestException('Imtihon hali tayyor emas');

    const resume = await this.prisma.examAttempt.findFirst({
      where: { userId: user.id, examId: dto.examId, status: AttemptStatus.IN_PROGRESS },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (resume) return { attemptId: resume.id, resumed: true };

    const grant = await this.access.resolveForAttempt(user.id, user.role, dto.examId); // to'lov kerak bo'lsa 402

    try {
      const attempt = await this.prisma.examAttempt.create({
        data: { userId: user.id, examId: dto.examId, accessType: grant.accessType, paymentId: grant.paymentId },
        select: { id: true },
      });
      return { attemptId: attempt.id, resumed: false };
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('Bu to‘lov bilan urinish allaqachon ochilgan');
      throw e;
    }
  }

  /** Imtihon "lobbisi": har bir bo'lim holati, vaqti va boshlash mumkinmi */
  async overview(user: AuthUser, attemptId: string) {
    await this.settleExpired(attemptId, user);
    const attempt = await this.getOwnAttempt(user, attemptId);

    const active = attempt.sections.some((s) => s.status === AttemptStatus.IN_PROGRESS);
    const inProgress = attempt.status === AttemptStatus.IN_PROGRESS;
    const deadline = this.attemptDeadline(attempt);

    const sections = attempt.exam.sections.map((es) => {
      const sa = attempt.sections.find((s) => s.sectionId === es.id);
      const previousDone =
        attempt.exam.type !== ExamType.FULL_MULTILEVEL ||
        attempt.exam.sections.filter((p) => p.order < es.order).every((p) => attempt.sections.some((s) => s.sectionId === p.id));
      return {
        sectionId: es.id,
        skill: es.skill,
        order: es.order,
        title: es.title,
        timeLimitSec: es.timeLimitSec,
        state: sa ? sa.status : 'NOT_STARTED',
        startedAt: sa?.startedAt ?? null,
        expiresAt: sa?.expiresAt ?? null,
        remainingSec: sa?.status === AttemptStatus.IN_PROGRESS ? this.remainingSec(sa.expiresAt) : null,
        canStart: inProgress && !sa && !active && previousDone,
      };
    });

    return {
      attemptId: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      serverTime: new Date(),
      deadline,
      exam: { id: attempt.exam.id, title: attempt.exam.title, type: attempt.exam.type, durationMinutes: attempt.exam.durationMinutes },
      sections,
    };
  }

  /* ───────────── Bo'limni boshlash va mazmuni ───────────── */

  private async sectionPayload(attemptId: string, sectionAttemptId: string) {
    const sa = await this.prisma.sectionAttempt.findUniqueOrThrow({ where: { id: sectionAttemptId } });
    const content = await this.content.buildContent(sa.sectionId, sa.id);
    return {
      attemptId,
      sectionAttemptId: sa.id,
      startedAt: sa.startedAt,
      expiresAt: sa.expiresAt,
      remainingSec: this.remainingSec(sa.expiresAt),
      serverTime: new Date(),
      ...content,
    };
  }

  async startSection(user: AuthUser, attemptId: string, sectionId: string) {
    await this.settleExpired(attemptId, user);
    const attempt = await this.getOwnAttempt(user, attemptId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) throw new ConflictException('Imtihon yakunlangan');

    const section = attempt.exam.sections.find((s) => s.id === sectionId);
    if (!section) throw new NotFoundException('Bo‘lim topilmadi');

    const existing = attempt.sections.find((s) => s.sectionId === sectionId);
    if (existing) {
      if (existing.status === AttemptStatus.IN_PROGRESS) return this.sectionPayload(attemptId, existing.id); // davom ettirish
      throw new ConflictException('Bu bo‘lim allaqachon topshirilgan');
    }
    if (attempt.sections.some((s) => s.status === AttemptStatus.IN_PROGRESS)) {
      throw new ConflictException('Avval joriy bo‘limni yakunlang');
    }
    if (attempt.exam.type === ExamType.FULL_MULTILEVEL) {
      const previous = attempt.exam.sections.filter((s) => s.order < section.order);
      if (previous.some((p) => !attempt.sections.some((s) => s.sectionId === p.id))) {
        throw new ConflictException('Bo‘limlar ketma-ket topshiriladi');
      }
    }

    const now = new Date();
    const deadline = this.attemptDeadline(attempt);
    if (deadline && deadline <= now) {
      await this.finishInternal(attemptId);
      throw new ConflictException('Imtihon vaqti tugagan');
    }

    let expiresAt: Date | null = section.timeLimitSec ? new Date(now.getTime() + section.timeLimitSec * 1000) : null;
    if (deadline && (!expiresAt || deadline < expiresAt)) expiresAt = deadline;

    let sectionAttemptId: string;
    try {
      const created = await this.prisma.sectionAttempt.create({
        data: { attemptId, sectionId, status: AttemptStatus.IN_PROGRESS, startedAt: now, expiresAt, maxScore: section.maxScore },
        select: { id: true },
      });
      sectionAttemptId = created.id;
    } catch (e) {
      if (!isUnique(e)) throw e;
      const again = await this.prisma.sectionAttempt.findUniqueOrThrow({
        where: { attemptId_sectionId: { attemptId, sectionId } },
        select: { id: true, status: true },
      });
      if (again.status !== AttemptStatus.IN_PROGRESS) throw new ConflictException('Bu bo‘lim allaqachon topshirilgan');
      sectionAttemptId = again.id;
    }

    await this.touch(attemptId);
    return this.sectionPayload(attemptId, sectionAttemptId);
  }

  async getSectionContent(user: AuthUser, attemptId: string, sectionId: string) {
    await this.settleExpired(attemptId, user);
    const attempt = await this.getOwnAttempt(user, attemptId);
    const sa = attempt.sections.find((s) => s.sectionId === sectionId);
    if (!sa) throw new NotFoundException('Bo‘lim hali boshlanmagan');
    if (sa.status !== AttemptStatus.IN_PROGRESS) throw new ConflictException('Bu bo‘lim yakunlangan');
    return this.sectionPayload(attemptId, sa.id);
  }

  /** Joriy (davom etayotgan) bo'lim urinishini topadi va vaqti tugamaganini tekshiradi */
  private async requireActiveSection(user: AuthUser, attemptId: string, sectionId?: string) {
    await this.settleExpired(attemptId, user);
    const attempt = await this.getOwnAttempt(user, attemptId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) throw new ConflictException('Imtihon yakunlangan');

    const sa = attempt.sections.find((s) => s.status === AttemptStatus.IN_PROGRESS && (!sectionId || s.sectionId === sectionId));
    if (!sa) throw new ConflictException('Faol bo‘lim yo‘q yoki u yakunlangan');
    if (sa.expiresAt && sa.expiresAt.getTime() + this.graceMs < Date.now()) {
      await this.submitSectionInternal(sa.id);
      await this.settleIfAllDone(attemptId);
      throw new ConflictException('Bo‘lim vaqti tugadi');
    }
    return { attempt, sa };
  }

  /* ───────────── Javoblarni saqlash (avto-saqlash) ───────────── */

  async saveAnswers(user: AuthUser, attemptId: string, sectionId: string, dto: SaveAnswersDto) {
    const { sa } = await this.requireActiveSection(user, attemptId, sectionId);

    const questions = await this.prisma.question.findMany({
      where: { part: { sectionId } },
      select: {
        id: true,
        type: true,
        options: { select: { id: true } },
        part: { select: { options: { select: { id: true } } } },
      },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));

    const existing = await this.prisma.answer.findMany({
      where: { sectionAttemptId: sa.id, questionId: { in: dto.answers.map((a) => a.questionId) } },
      select: { questionId: true, audioKey: true },
    });
    const oldAudio = new Map(existing.map((e) => [e.questionId, e.audioKey]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const removeKeys: string[] = [];
    const seen = new Set<string>();

    for (const input of dto.answers) {
      const q = byId.get(input.questionId);
      if (!q) throw new BadRequestException(`Savol ${input.questionId} bu bo‘limga tegishli emas`);
      if (seen.has(q.id)) throw new BadRequestException('Bitta savol ikki marta yuborilgan');
      seen.add(q.id);

      const where = { sectionAttemptId_questionId: { sectionAttemptId: sa.id, questionId: q.id } };
      const data: Prisma.AnswerUncheckedUpdateInput = {
        selectedOptionId: null,
        selectedPartOptionId: null,
        textAnswer: null,
        wordCount: null,
        audioKey: null,
        audioUrl: null,
        durationSec: null,
        transcript: null,
        isCorrect: null,
        pointsAwarded: null,
      };
      let empty = true;

      switch (q.type) {
        case QuestionType.MULTIPLE_CHOICE:
          if (input.selectedOptionId) {
            if (!q.options.some((o) => o.id === input.selectedOptionId)) throw new BadRequestException('Variant bu savolga tegishli emas');
            data.selectedOptionId = input.selectedOptionId;
            empty = false;
          }
          break;

        case QuestionType.MATCHING:
          if (input.selectedPartOptionId) {
            if (!q.part.options.some((o) => o.id === input.selectedPartOptionId)) throw new BadRequestException('Variant bu partga tegishli emas');
            data.selectedPartOptionId = input.selectedPartOptionId;
            empty = false;
          }
          break;

        case QuestionType.TRUE_FALSE_NG: {
          const v = input.textAnswer?.trim().toUpperCase().replace(/[\s-]+/g, '_');
          if (v) {
            if (!TFNG.includes(v)) throw new BadRequestException('Javob TRUE, FALSE yoki NOT_GIVEN bo‘lishi kerak');
            data.textAnswer = v;
            empty = false;
          }
          break;
        }

        case QuestionType.SHORT_ANSWER: {
          const v = input.textAnswer?.trim();
          if (v) {
            if (v.length > 200) throw new BadRequestException('Javob juda uzun');
            data.textAnswer = v;
            empty = false;
          }
          break;
        }

        case QuestionType.WRITING_PROMPT: {
          const v = input.textAnswer ?? '';
          if (v.trim()) {
            data.textAnswer = v;
            data.wordCount = countWords(v);
            empty = false;
          }
          break;
        }

        case QuestionType.SPEAKING_PROMPT:
          if (input.audioKey) {
            if (!input.audioKey.startsWith(SPEAKING_KEY_PREFIX)) {
              throw new BadRequestException('Audio kaliti noto‘g‘ri. Avval POST /storage/presign (SPEAKING_AUDIO) orqali yuklang');
            }
            data.audioKey = input.audioKey;
            data.audioUrl = this.storage.publicUrl(input.audioKey);
            data.durationSec = input.durationSec ?? null;
            empty = false;
          }
          break;
      }

      const previous = oldAudio.get(q.id);
      if (previous && previous !== data.audioKey) removeKeys.push(previous);

      if (empty) {
        ops.push(this.prisma.answer.deleteMany({ where: { sectionAttemptId: sa.id, questionId: q.id } }));
      } else {
        ops.push(
          this.prisma.answer.upsert({
            where,
            create: {
              ...(data as Prisma.AnswerUncheckedCreateInput),
              sectionAttemptId: sa.id,
              questionId: q.id,
            },
            update: data,
          }),
        );
      }
    }

    await this.prisma.$transaction(ops);
    await Promise.allSettled(removeKeys.map((k) => this.storage.remove(k)));

    const current = await this.prisma.sectionAttempt.findUniqueOrThrow({ where: { id: sa.id }, select: { expiresAt: true } });
    return { saved: dto.answers.length, remainingSec: this.remainingSec(current.expiresAt), serverTime: new Date() };
  }

  /* ───────────── Listening audiosi ───────────── */

  async playAudio(user: AuthUser, attemptId: string, dto: PlayAudioDto) {
    if (!!dto.partId === !!dto.questionId) throw new BadRequestException('partId yoki questionId dan aynan bittasini yuboring');
    const { sa } = await this.requireActiveSection(user, attemptId);
    return this.content.issueAudio(sa.id, sa.sectionId, { partId: dto.partId, questionId: dto.questionId });
  }

  /* ───────────── Topshirish va yakunlash ───────────── */

  async submitSection(user: AuthUser, attemptId: string, sectionId: string) {
    await this.settleExpired(attemptId, user);
    const attempt = await this.getOwnAttempt(user, attemptId);
    const sa = attempt.sections.find((s) => s.sectionId === sectionId);
    if (!sa) throw new NotFoundException('Bo‘lim hali boshlanmagan');

    if (sa.status === AttemptStatus.IN_PROGRESS) {
      await this.submitSectionInternal(sa.id);
    }
    const finished = await this.settleIfAllDone(attemptId);
    return { sectionId, submitted: true, attemptFinished: finished };
  }

  /** Imtihonni oxirigacha tugatish: davom etayotgan bo'lim topshiriladi, boshlanmaganlari 0 ball bilan yopiladi */
  async finish(user: AuthUser, attemptId: string) {
    await this.getOwnAttempt(user, attemptId);
    await this.finishInternal(attemptId);
    const attempt = await this.prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: { id: true, status: true } });
    return { attemptId, status: attempt.status };
  }

  /** Bo'limni yopadi (idempotent): Listening / Reading darhol baholanadi, Writing / Speaking AI navbatiga tushadi */
  private async submitSectionInternal(sectionAttemptId: string): Promise<boolean> {
    const claimed = await this.prisma.sectionAttempt.updateMany({
      where: { id: sectionAttemptId, status: AttemptStatus.IN_PROGRESS },
      data: { status: AttemptStatus.SUBMITTED, finishedAt: new Date() },
    });
    if (claimed.count === 0) return false;

    const sa = await this.prisma.sectionAttempt.findUniqueOrThrow({
      where: { id: sectionAttemptId },
      select: { attemptId: true, section: { select: { skill: true } } },
    });

    try {
      if (sa.section.skill === Skill.LISTENING || sa.section.skill === Skill.READING) {
        await this.scoring.gradeObjectiveSection(sectionAttemptId);
        await this.prisma.sectionAttempt.update({ where: { id: sectionAttemptId }, data: { status: AttemptStatus.COMPLETED } });
      } else {
        await this.ai.enqueueSection(sectionAttemptId);
      }
    } catch (e) {
      // Bo'lim SUBMITTED holatida qoladi; admin POST /scoring/attempts/:id/recalculate yoki AI retry bilan tuzatadi
      this.log.error(`Bo‘lim ${sectionAttemptId} baholanmadi: ${(e as Error).message}`);
    }

    await this.touch(sa.attemptId);
    return true;
  }

  /** Imtihonning barcha bo'limlari boshlangan va yopilgan bo'lsa, urinishni yakunlaydi */
  private async settleIfAllDone(attemptId: string): Promise<boolean> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        status: true,
        exam: { select: { sections: { select: { id: true } } } },
        sections: { select: { sectionId: true, status: true } },
      },
    });
    if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS) return false;

    const allStarted = attempt.exam.sections.every((es) => attempt.sections.some((s) => s.sectionId === es.id));
    const noneActive = attempt.sections.every((s) => s.status !== AttemptStatus.IN_PROGRESS);
    if (!allStarted || !noneActive) return false;

    await this.finishInternal(attemptId);
    return true;
  }

  private async finishInternal(attemptId: string) {
    const claimed = await this.prisma.examAttempt.updateMany({
      where: { id: attemptId, status: AttemptStatus.IN_PROGRESS },
      data: { status: AttemptStatus.GRADING, finishedAt: new Date() },
    });
    if (claimed.count === 0) return;

    const attempt = await this.prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: {
        exam: { select: { sections: { select: { id: true, maxScore: true } } } },
        sections: { select: { id: true, sectionId: true, status: true } },
      },
    });

    for (const sa of attempt.sections) {
      if (sa.status === AttemptStatus.IN_PROGRESS) await this.submitSectionInternal(sa.id);
    }

    // Boshlanmagan bo'limlar 0 ball bilan yopiladi
    const started = new Set(attempt.sections.map((s) => s.sectionId));
    const missing = attempt.exam.sections.filter((s) => !started.has(s.id));
    if (missing.length > 0) {
      const now = new Date();
      await this.prisma.sectionAttempt.createMany({
        data: missing.map((s) => ({
          attemptId,
          sectionId: s.id,
          status: AttemptStatus.COMPLETED,
          startedAt: now,
          finishedAt: now,
          rawScore: 0,
          score: 0,
          maxScore: s.maxScore,
          aiSummary: { skipped: true } as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
    }

    await this.scoring.syncAttemptScores(attemptId); // hammasi baholangan bo'lsa COMPLETED + CEFR
  }

  /** Vaqti tugagan bo'limlarni (va CUSTOM umumiy vaqti tugagan urinishni) lazy tarzda yopadi */
  private async settleExpired(attemptId: string, user?: AuthUser) {
    if (user) {
      const own = await this.prisma.examAttempt.count({ where: { id: attemptId, userId: user.id } });
      if (!own) throw new NotFoundException('Urinish topilmadi');
    }

    const cutoff = new Date(Date.now() - this.graceMs);
    const overdue = await this.prisma.sectionAttempt.findMany({
      where: { attemptId, status: AttemptStatus.IN_PROGRESS, expiresAt: { lt: cutoff } },
      select: { id: true },
    });
    for (const o of overdue) await this.submitSectionInternal(o.id);

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { status: true, startedAt: true, exam: { select: { type: true, durationMinutes: true } } },
    });
    if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS) return;

    const deadline = this.attemptDeadline(attempt);
    if (deadline && deadline.getTime() + this.graceMs < Date.now()) {
      await this.finishInternal(attemptId);
    } else if (overdue.length > 0) {
      await this.settleIfAllDone(attemptId);
    }
  }

  /** Har daqiqada: vaqti tugagan bo'limlarni yopadi, tashlab ketilgan urinishlarni yakunlaydi */
  private async sweep() {
    const now = Date.now();

    const overdue = await this.prisma.sectionAttempt.findMany({
      where: { status: AttemptStatus.IN_PROGRESS, expiresAt: { lt: new Date(now - this.graceMs) } },
      take: 100,
      select: { id: true, attemptId: true },
    });
    for (const o of overdue) {
      await this.submitSectionInternal(o.id);
      await this.settleIfAllDone(o.attemptId);
    }

    const customs = await this.prisma.examAttempt.findMany({
      where: { status: AttemptStatus.IN_PROGRESS, exam: { type: ExamType.CUSTOM, durationMinutes: { not: null } } },
      take: 200,
      select: { id: true, startedAt: true, exam: { select: { durationMinutes: true } } },
    });
    for (const c of customs) {
      const deadline = c.startedAt.getTime() + (c.exam.durationMinutes ?? 0) * 60_000;
      if (deadline + this.graceMs < now) await this.finishInternal(c.id);
    }

    const stale = await this.prisma.examAttempt.findMany({
      where: {
        status: AttemptStatus.IN_PROGRESS,
        updatedAt: { lt: new Date(now - this.abandonMs) },
        sections: { none: { status: AttemptStatus.IN_PROGRESS } },
      },
      take: 50,
      select: { id: true },
    });
    for (const s of stale) await this.finishInternal(s.id);
  }
}
