import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AttemptStatus, EvalStatus, FileKind, Prisma, Role, Skill } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { weightedAverage, round1 } from '../../common/scoring';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { StorageService } from '../storage/storage.service';
import { AiError, sleep } from './ai-error';
import { AiGraderService } from './ai-grader.service';
import { AsyncQueue } from './async-queue';
import { ListEvaluationsQueryDto } from './dto/list-evaluations-query.dto';
import { ReviewEvaluationDto } from './dto/review-evaluation.dto';
import { SttService } from './stt.service';

const RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 120_000]; // jami 5 ta urinish // jami 3 ta urinish
const READ_URL_TTL = 60 * 60;

const DEFAULT_CRITERIA: Record<'WRITING' | 'SPEAKING', string[]> = {
  WRITING: ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammar'],
  SPEAKING: ['fluency_coherence', 'lexical_resource', 'grammar', 'task_achievement'],
};

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** question.rubric.criteria berilgan bo'lsa shuni, aks holda standart mezonlarni qaytaradi */
function criteriaFor(skill: Skill, rubric: Prisma.JsonValue | null): string[] {
  const raw = rubric && typeof rubric === 'object' && !Array.isArray(rubric) ? (rubric as Record<string, unknown>).criteria : null;
  if (Array.isArray(raw)) {
    const custom = raw
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))
      .filter(Boolean);
    const unique = [...new Set(custom)].slice(0, 8);
    if (unique.length >= 2) return unique;
  }
  return DEFAULT_CRITERIA[skill === Skill.WRITING ? 'WRITING' : 'SPEAKING'];
}

@Injectable()
export class AiEvaluationService implements OnModuleInit {
  private readonly log = new Logger(AiEvaluationService.name);
  private readonly queue = new AsyncQueue(Number(process.env.AI_CONCURRENCY || 2), (id) => this.process(id));

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly stt: SttService,
    private readonly grader: AiGraderService,
    private readonly scoring: ScoringService,
  ) {}

  /** Server qayta ishga tushganda yarim qolgan baholashlarni navbatga qaytaramiz */
  onModuleInit() {
    const timer = setTimeout(() => {
      this.recover().catch((e) => this.log.error(`Navbatni tiklab bo‘lmadi: ${(e as Error).message}`));
    }, 5_000);
    timer.unref?.();
  }

  private async recover() {
    await this.prisma.aiEvaluation.updateMany({
      where: { status: EvalStatus.PROCESSING },
      data: { status: EvalStatus.PENDING },
    });
    const pending = await this.prisma.aiEvaluation.findMany({
      where: { status: EvalStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: { id: true },
    });
    pending.forEach((p) => this.queue.push(p.id));
    if (pending.length > 0) this.log.log(`${pending.length} ta kutilayotgan baholash navbatga qo‘yildi`);
  }

  /* ───────────── Navbatga qo'yish (10-bo'lim shuni chaqiradi) ───────────── */

  /**
   * Writing / Speaking bo'limi topshirilganda chaqiriladi: har bir javob uchun baholash yaratadi va navbatga qo'yadi.
   * Hammasi tugagach bo'lim bali avtomatik hisoblanadi va umumiy natija yangilanadi.
   */
  async enqueueSection(sectionAttemptId: string, opts: { force?: boolean } = {}) {
    const sa = await this.prisma.sectionAttempt.findUnique({
      where: { id: sectionAttemptId },
      include: { section: { select: { skill: true } }, answers: { select: { id: true, evaluation: { select: { status: true } } } } },
    });
    if (!sa) throw new NotFoundException('Bo‘lim urinishi topilmadi');
    if (sa.section.skill !== Skill.WRITING && sa.section.skill !== Skill.SPEAKING) {
      throw new BadRequestException('AI baholash faqat Writing va Speaking uchun');
    }

    await this.prisma.sectionAttempt.update({ where: { id: sectionAttemptId }, data: { status: AttemptStatus.GRADING } });

    const toRun: string[] = [];
    for (const answer of sa.answers) {
      if (answer.evaluation?.status === EvalStatus.DONE && !opts.force) continue;
      const ev = await this.prisma.aiEvaluation.upsert({
        where: { answerId: answer.id },
        create: { answerId: answer.id, status: EvalStatus.PENDING },
        update: { status: EvalStatus.PENDING, errorMessage: null },
        select: { id: true },
      });
      toRun.push(ev.id);
    }

    toRun.forEach((id) => this.queue.push(id));
    if (toRun.length === 0) await this.refreshSection(sectionAttemptId); // javob umuman yo'q yoki hammasi tayyor
    return { sectionAttemptId, queued: toRun.length };
  }

  /* ───────────── Bitta javobni baholash ───────────── */

  private async process(evaluationId: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        await this.runOnce(evaluationId);
        return;
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError((e as Error).message ?? 'Noma‘lum xato');
        const canRetry = err.retryable && attempt < RETRY_DELAYS_MS.length;
        this.log.warn(`Baholash ${evaluationId} xato (urinish ${attempt + 1}): ${err.message}${canRetry ? ' — qayta uriniladi' : ''}`);
        if (!canRetry) {
          await this.prisma.aiEvaluation
            .update({ where: { id: evaluationId }, data: { status: EvalStatus.FAILED, errorMessage: err.message.slice(0, 500) } })
            .catch(() => undefined);
          return;
        }
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  private async collectImages(
    part: { imageUrl: string | null; imageKey: string | null },
    media: { kind: FileKind; url: string; storageKey: string | null }[],
  ): Promise<string[]> {
    const items = [
      { url: part.imageUrl, key: part.imageKey },
      ...media.filter((m) => m.kind === FileKind.IMAGE).map((m) => ({ url: m.url, key: m.storageKey })),
    ];
    const urls: string[] = [];
    for (const item of items) {
      let url: string | null = null;
      if (item.key) {
        url = this.storage.publicUrl(item.key);
        if (!url) url = await this.storage.getReadUrl(item.key, READ_URL_TTL).catch(() => null);
      } else if (item.url) {
        url = item.url;
      }
      if (url && /^https?:\/\//.test(url)) urls.push(url);
    }
    return urls;
  }

  private async runOnce(evaluationId: string) {
    const ev = await this.prisma.aiEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        answer: {
          include: {
            question: {
              include: {
                media: true,
                part: { select: { instructions: true, imageUrl: true, imageKey: true } },
              },
            },
            sectionAttempt: { select: { id: true, section: { select: { skill: true } } } },
          },
        },
      },
    });
    if (!ev) return;
    if (ev.status === EvalStatus.DONE) return;

    await this.prisma.aiEvaluation.update({ where: { id: evaluationId }, data: { status: EvalStatus.PROCESSING, errorMessage: null } });

    const { answer } = ev;
    const { question } = answer;
    const skill = answer.sectionAttempt.section.skill;
    const criteria = criteriaFor(skill, question.rubric);

    // 1) Javob matni: Writing — yozilgan matn, Speaking — audio transkripti
    let response = '';
    if (skill === Skill.WRITING) {
      response = answer.textAnswer ?? '';
    } else {
      response = answer.transcript ?? '';
      if (!response && answer.audioKey) {
        response = await this.stt.transcribe(answer.audioKey);
        await this.prisma.answer.update({ where: { id: answer.id }, data: { transcript: response } });
      }
    }

    const wordCount = countWords(response);
    if (skill === Skill.WRITING && answer.wordCount !== wordCount) {
      await this.prisma.answer.update({ where: { id: answer.id }, data: { wordCount } });
    }

    // 2) Bo'sh yoki juda qisqa javob: AI ni chaqirmasdan 0 ball
    const tooShort = skill === Skill.WRITING ? wordCount < 5 : wordCount < 3;
    if (tooShort) {
      const zero = Object.fromEntries(criteria.map((c) => [c, { score: 0, comment: 'Javob juda qisqa yoki bo‘sh.' }]));
      await this.finish(ev.id, answer.sectionAttempt.id, {
        score: 0,
        criteria: zero,
        feedback: 'Javob juda qisqa yoki bo‘sh bo‘lgani uchun baholash uchun yetarli ma’lumot yo‘q.',
        suggestions: [],
        model: 'rule',
        raw: { reason: 'too_short', wordCount },
      });
      return;
    }

    // 3) Claude baholaydi
    const images = await this.collectImages(question.part, question.media);
    const result = await this.grader.grade({
      skill,
      questionText: question.text,
      instructions: question.part.instructions,
      criteria,
      response,
      wordCount,
      minWords: question.minWords,
      maxWords: question.maxWords,
      durationSec: answer.durationSec,
      images,
    });

    await this.finish(ev.id, answer.sectionAttempt.id, {
      score: result.score,
      criteria: result.criteria,
      feedback: result.feedback,
      suggestions: result.suggestions,
      model: result.model,
      raw: { estimatedCefr: result.estimatedCefr, usage: result.usage, imagesSkipped: result.imagesSkipped, wordCount },
    });
  }

  private async finish(
    evaluationId: string,
    sectionAttemptId: string,
    data: {
      score: number;
      criteria: Record<string, { score: number; comment: string }>;
      feedback: string;
      suggestions: string[];
      model: string;
      raw: Record<string, unknown>;
    },
  ) {
    await this.prisma.aiEvaluation.update({
      where: { id: evaluationId },
      data: {
        status: EvalStatus.DONE,
        model: data.model,
        score: data.score,
        criteria: data.criteria as Prisma.InputJsonValue,
        feedback: data.feedback,
        suggestions: data.suggestions,
        rawResponse: data.raw as Prisma.InputJsonValue,
        errorMessage: null,
      },
    });
    await this.refreshSection(sectionAttemptId);
  }

  /* ───────────── Bo'lim balini hisoblash ───────────── */

  /**
   * Bo'limdagi HAMMA javobning baholashi DONE bo'lsa: bo'lim bali = savollar bali (points) bo'yicha vaznli o'rtacha
   * (final ball bor bo'lsa u, aks holda AI bali; javob berilmagan savol = 0). Keyin umumiy natija yangilanadi.
   */
  async refreshSection(sectionAttemptId: string) {
    const sa = await this.prisma.sectionAttempt.findUnique({
      where: { id: sectionAttemptId },
      select: { id: true, sectionId: true, finishedAt: true },
    });
    if (!sa) return { finalized: false };

    const [questions, answers] = await Promise.all([
      this.prisma.question.findMany({ where: { part: { sectionId: sa.sectionId } }, select: { id: true, points: true } }),
      this.prisma.answer.findMany({
        where: { sectionAttemptId },
        select: {
          questionId: true,
          evaluation: { select: { status: true, score: true, finalScore: true, criteria: true, suggestions: true } },
        },
      }),
    ]);

    const waiting = answers.some((a) => !a.evaluation || a.evaluation.status !== EvalStatus.DONE);
    if (waiting) return { finalized: false };

    const byQuestion = new Map(answers.map((a) => [a.questionId, a.evaluation]));
    const items = questions.map((q) => {
      const ev = byQuestion.get(q.id);
      return { value: ev ? (ev.finalScore ?? ev.score ?? 0) : 0, weight: q.points > 0 ? q.points : 1 };
    });
    const score = weightedAverage(items) ?? 0;

    // Bo'lim bo'yicha umumiy tahlil: mezonlar o'rtachasi va takrorlanmas maslahatlar
    const sums = new Map<string, { total: number; n: number }>();
    const suggestions: string[] = [];
    for (const a of answers) {
      const crit = a.evaluation?.criteria;
      if (crit && typeof crit === 'object' && !Array.isArray(crit)) {
        for (const [name, v] of Object.entries(crit as Record<string, { score?: number }>)) {
          if (typeof v?.score !== 'number') continue;
          const cur = sums.get(name) ?? { total: 0, n: 0 };
          sums.set(name, { total: cur.total + v.score, n: cur.n + 1 });
        }
      }
      for (const s of a.evaluation?.suggestions ?? []) if (!suggestions.includes(s)) suggestions.push(s);
    }
    const criteriaAverages = Object.fromEntries([...sums].map(([name, v]) => [name, round1(v.total / v.n)]));

    await this.scoring.setSectionScore(sectionAttemptId, score, {
      source: 'ai',
      criteriaAverages,
      suggestions: suggestions.slice(0, 8),
      evaluatedAnswers: answers.length,
    });
    await this.prisma.sectionAttempt.update({
      where: { id: sectionAttemptId },
      data: { status: AttemptStatus.COMPLETED, finishedAt: sa.finishedAt ?? new Date() },
    });

    return { finalized: true, score };
  }

  /* ───────────── Admin / o'qituvchi ───────────── */

  /** ADMIN hammasini, TEACHER faqat o'z imtihonlaridagi baholashlarni ko'radi */
  private scope(user: AuthUser): Prisma.AiEvaluationWhereInput {
    return user.role === Role.ADMIN ? {} : { answer: { sectionAttempt: { section: { exam: { createdById: user.id } } } } };
  }

  async list(user: AuthUser, query: ListEvaluationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const sectionFilter: Prisma.ExamSectionWhereInput = {
      ...(query.skill ? { skill: query.skill } : {}),
      ...(query.examId ? { examId: query.examId } : {}),
    };
    const where: Prisma.AiEvaluationWhereInput = {
      AND: [
        this.scope(user),
        query.status ? { status: query.status } : {},
        Object.keys(sectionFilter).length ? { answer: { sectionAttempt: { section: sectionFilter } } } : {},
      ],
    };

    const [total, items] = await Promise.all([
      this.prisma.aiEvaluation.count({ where }),
      this.prisma.aiEvaluation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          score: true,
          finalScore: true,
          errorMessage: true,
          createdAt: true,
          answer: {
            select: {
              id: true,
              question: { select: { id: true, number: true, type: true } },
              sectionAttempt: {
                select: {
                  id: true,
                  section: { select: { skill: true } },
                  attempt: { select: { id: true, user: { select: { id: true, name: true } }, exam: { select: { id: true, title: true } } } },
                },
              },
            },
          },
        },
      }),
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async stats() {
    const groups = await this.prisma.aiEvaluation.groupBy({ by: ['status'], _count: { _all: true } });
    return {
      queueSize: this.queue.size,
      byStatus: Object.fromEntries(groups.map((g) => [g.status, g._count._all])),
    };
  }

  async getOne(user: AuthUser, id: string) {
    const ev = await this.prisma.aiEvaluation.findFirst({
      where: { id, ...this.scope(user) },
      include: {
        answer: {
          select: {
            id: true,
            textAnswer: true,
            wordCount: true,
            transcript: true,
            audioKey: true,
            audioUrl: true,
            durationSec: true,
            question: { select: { id: true, number: true, type: true, text: true, minWords: true, maxWords: true, rubric: true } },
            sectionAttempt: {
              select: {
                id: true,
                section: { select: { skill: true } },
                attempt: { select: { id: true, user: { select: { id: true, name: true, phone: true } }, exam: { select: { id: true, title: true } } } },
              },
            },
          },
        },
      },
    });
    if (!ev) throw new NotFoundException('Baholash topilmadi');

    let audioUrl = ev.answer.audioUrl;
    if (!audioUrl && ev.answer.audioKey) {
      audioUrl = this.storage.publicUrl(ev.answer.audioKey) ?? (await this.storage.getReadUrl(ev.answer.audioKey, READ_URL_TTL).catch(() => null));
    }
    const { audioKey, ...answer } = ev.answer;
    return { ...ev, answer: { ...answer, audioUrl } };
  }

  /** O'qituvchi / admin AI bahosini o'zgartiradi: finalScore AI balining o'rniga hisobga olinadi */
  async review(user: AuthUser, id: string, dto: ReviewEvaluationDto) {
    const ev = await this.prisma.aiEvaluation.findFirst({
      where: { id, ...this.scope(user) },
      select: { id: true, status: true, answer: { select: { sectionAttemptId: true } } },
    });
    if (!ev) throw new NotFoundException('Baholash topilmadi');
    if (ev.status !== EvalStatus.DONE && ev.status !== EvalStatus.FAILED) {
      throw new ConflictException('AI hali baholab bo‘lmagan, biroz kuting');
    }

    await this.prisma.aiEvaluation.update({
      where: { id },
      data: {
        status: EvalStatus.DONE,
        finalScore: round1(dto.finalScore),
        reviewedById: user.id,
        reviewedAt: new Date(),
        errorMessage: null,
        ...(dto.feedback ? { feedback: dto.feedback.trim() } : {}),
      },
    });

    const section = await this.refreshSection(ev.answer.sectionAttemptId);
    return { id, finalScore: round1(dto.finalScore), section };
  }

  /** Xato bilan tugagan (yoki natijasi yoqmagan) baholashni qayta ishga tushiradi */
  async retry(user: AuthUser, id: string) {
    const ev = await this.prisma.aiEvaluation.findFirst({
      where: { id, ...this.scope(user) },
      select: { id: true, status: true, answer: { select: { sectionAttemptId: true } } },
    });
    if (!ev) throw new NotFoundException('Baholash topilmadi');
    if (ev.status !== EvalStatus.FAILED && ev.status !== EvalStatus.DONE) {
      throw new ConflictException('Baholash hozir bajarilmoqda yoki navbatda');
    }

    await this.prisma.$transaction([
      this.prisma.aiEvaluation.update({
        where: { id },
        data: { status: EvalStatus.PENDING, errorMessage: null, finalScore: null, reviewedById: null, reviewedAt: null },
      }),
      this.prisma.sectionAttempt.update({ where: { id: ev.answer.sectionAttemptId }, data: { status: AttemptStatus.GRADING } }),
    ]);
    this.queue.push(id);
    return { id, status: EvalStatus.PENDING };
  }

  /** Talaba natija sahifasi uchun (10-bo'lim ishlatadi): har bir savol bo'yicha ball, mezonlar va maslahatlar */
  async getForAttempt(attemptId: string) {
    const items = await this.prisma.aiEvaluation.findMany({
      where: { answer: { sectionAttempt: { attemptId } } },
      select: {
        status: true,
        score: true,
        finalScore: true,
        criteria: true,
        feedback: true,
        suggestions: true,
        answer: {
          select: {
            questionId: true,
            wordCount: true,
            transcript: true,
            question: { select: { number: true, text: true } },
            sectionAttempt: { select: { section: { select: { skill: true } } } },
          },
        },
      },
    });

    return items.map((e) => ({
      skill: e.answer.sectionAttempt.section.skill,
      questionId: e.answer.questionId,
      questionNumber: e.answer.question.number,
      questionText: e.answer.question.text,
      status: e.status,
      score: e.finalScore ?? e.score,
      aiScore: e.score,
      reviewed: e.finalScore !== null,
      criteria: e.criteria,
      feedback: e.feedback,
      suggestions: e.suggestions,
      wordCount: e.answer.wordCount,
      transcript: e.answer.transcript,
    }));
  }
}
