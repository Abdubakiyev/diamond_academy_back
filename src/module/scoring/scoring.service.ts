import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExamType, Prisma, QuestionType, Skill } from '@prisma/client';
import { MAX_SKILL_SCORE, average, cefrFromScore, clamp, round1 } from '../../common/scoring';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ScoreConversionService } from './score-conversion.service';

type GradableQuestion = {
  id: string;
  type: QuestionType;
  points: number;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  correctPartOptionId: string | null;
  options: { id: string; isCorrect: boolean }[];
};

type GradableAnswer = {
  id: string;
  selectedOptionId: string | null;
  selectedPartOptionId: string | null;
  textAnswer: string | null;
};

/** Gap fill javobini solishtirish uchun: bo'shliqlar, tirnoq turlari va chekkadagi tinish belgilari tozalanadi */
function normalizeText(value: string, caseSensitive: boolean) {
  let s = value
    .normalize('NFKC')
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,;:!?"'()]+|[\s.,;:!?"'()]+$/g, '');
  if (!caseSensitive) s = s.toLowerCase();
  return s;
}

const normalizeTfng = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, '_');

@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversions: ScoreConversionService,
  ) {}

  /* ───────────── Listening / Reading: avtomatik tekshirish ───────────── */

  private isCorrect(q: GradableQuestion, a: GradableAnswer): boolean {
    switch (q.type) {
      case QuestionType.MULTIPLE_CHOICE:
        return !!a.selectedOptionId && q.options.some((o) => o.id === a.selectedOptionId && o.isCorrect);

      case QuestionType.MATCHING:
        return !!a.selectedPartOptionId && a.selectedPartOptionId === q.correctPartOptionId;

      case QuestionType.TRUE_FALSE_NG:
        return !!a.textAnswer && q.acceptedAnswers.includes(normalizeTfng(a.textAnswer));

      case QuestionType.SHORT_ANSWER: {
        if (!a.textAnswer) return false;
        const given = normalizeText(a.textAnswer, q.caseSensitive);
        if (!given) return false;
        return q.acceptedAnswers.some((acc) => normalizeText(acc, q.caseSensitive) === given);
      }

      default:
        return false;
    }
  }

  /** Bo'lim urinishidagi javoblarni tekshiradi, raw va 0-75 ballni SectionAttempt ga yozadi (status o'zgarmaydi) */
  async gradeObjectiveSection(sectionAttemptId: string) {
    const sa = await this.prisma.sectionAttempt.findUnique({
      where: { id: sectionAttemptId },
      include: {
        section: { select: { id: true, skill: true, examId: true, maxScore: true } },
        answers: {
          select: { id: true, questionId: true, selectedOptionId: true, selectedPartOptionId: true, textAnswer: true },
        },
      },
    });
    if (!sa) throw new NotFoundException('Bo‘lim urinishi topilmadi');

    const { skill, examId } = sa.section;
    if (skill !== Skill.LISTENING && skill !== Skill.READING) {
      throw new BadRequestException('Avtomatik tekshirish faqat Listening va Reading uchun');
    }

    const questions = await this.prisma.question.findMany({
      where: { part: { sectionId: sa.sectionId } },
      select: {
        id: true,
        type: true,
        points: true,
        acceptedAnswers: true,
        caseSensitive: true,
        correctPartOptionId: true,
        options: { select: { id: true, isCorrect: true } },
      },
    });

    const answers = new Map(sa.answers.map((a) => [a.questionId, a]));
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    let raw = 0;
    let maxRaw = 0;
    let correctCount = 0;

    for (const q of questions) {
      maxRaw += q.points;
      const ans = answers.get(q.id);
      if (!ans) continue;
      const correct = this.isCorrect(q, ans);
      if (correct) {
        raw += q.points;
        correctCount++;
      }
      updates.push(
        this.prisma.answer.update({
          where: { id: ans.id },
          data: { isCorrect: correct, pointsAwarded: correct ? q.points : 0 },
        }),
      );
    }

    const { scaled, source } = await this.conversions.convert(examId, skill, raw, maxRaw);
    const score = round1(clamp((scaled * sa.section.maxScore) / MAX_SKILL_SCORE, 0, sa.section.maxScore));

    await this.prisma.$transaction([
      ...updates,
      this.prisma.sectionAttempt.update({
        where: { id: sectionAttemptId },
        data: { rawScore: raw, score, maxScore: sa.section.maxScore },
      }),
    ]);

    return {
      sectionAttemptId,
      skill,
      rawScore: raw,
      maxRaw,
      correctCount,
      answeredCount: sa.answers.length,
      totalQuestions: questions.length,
      score,
      maxScore: sa.section.maxScore,
      conversionSource: source,
    };
  }

  /* ───────────── Writing / Speaking: AI yoki o'qituvchi bali ───────────── */

  /** AI (9-bo'lim) yoki admin yakuniy bo'lim ballini yozadi va umumiy natijani yangilaydi */
  async setSectionScore(sectionAttemptId: string, score: number, aiSummary?: Record<string, unknown>) {
    const sa = await this.prisma.sectionAttempt.findUnique({
      where: { id: sectionAttemptId },
      include: { section: { select: { maxScore: true } } },
    });
    if (!sa) throw new NotFoundException('Bo‘lim urinishi topilmadi');

    await this.prisma.sectionAttempt.update({
      where: { id: sectionAttemptId },
      data: {
        score: round1(clamp(score, 0, sa.section.maxScore)),
        maxScore: sa.section.maxScore,
        ...(aiSummary ? { aiSummary: aiSummary as Prisma.InputJsonValue } : {}),
      },
    });
    return this.syncAttemptScores(sa.attemptId);
  }

  /* ───────────── Umumiy natija va CEFR ───────────── */

  /**
   * Bo'lim ballarini ExamAttempt ga ko'chiradi. Imtihonning HAR BIR bo'limi uchun ball bo'lsa,
   * umumiy ball (o'rtacha) hisoblanadi, urinish COMPLETED bo'ladi. CEFR faqat to'liq Multilevel uchun.
   * Eslatma: topshirilmagan bo'lim uchun SectionAttempt (score = 0) 10-bo'limda yaratiladi.
   */
  async syncAttemptScores(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { select: { type: true, sections: { select: { id: true } } } },
        sections: { select: { sectionId: true, score: true, section: { select: { skill: true } } } },
      },
    });
    if (!attempt) throw new NotFoundException('Urinish topilmadi');

    const bySkill = new Map<Skill, number>();
    for (const s of attempt.sections) {
      if (s.score !== null) bySkill.set(s.section.skill, s.score);
    }

    const complete = attempt.exam.sections.every((es) =>
      attempt.sections.some((s) => s.sectionId === es.id && s.score !== null),
    );

    const totalScore = complete ? average([...bySkill.values()]) : null;
    const cefrLevel =
      complete && totalScore !== null && attempt.exam.type === ExamType.FULL_MULTILEVEL ? cefrFromScore(totalScore) : null;

    const updated = await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        listeningScore: bySkill.get(Skill.LISTENING) ?? null,
        readingScore: bySkill.get(Skill.READING) ?? null,
        writingScore: bySkill.get(Skill.WRITING) ?? null,
        speakingScore: bySkill.get(Skill.SPEAKING) ?? null,
        totalScore,
        cefrLevel,
        ...(complete ? { status: 'COMPLETED' as const, finishedAt: attempt.finishedAt ?? new Date() } : {}),
      },
      select: {
        id: true,
        status: true,
        listeningScore: true,
        readingScore: true,
        writingScore: true,
        speakingScore: true,
        totalScore: true,
        cefrLevel: true,
      },
    });

    return { complete, ...updated };
  }

  /** Admin jadvalni o'zgartirgach: Listening / Reading ni qayta tekshirib, natijani yangilaydi */
  async recalculateAttempt(attemptId: string) {
    const sections = await this.prisma.sectionAttempt.findMany({
      where: { attemptId, section: { skill: { in: [Skill.LISTENING, Skill.READING] } } },
      select: { id: true },
    });
    if (sections.length === 0) {
      const exists = await this.prisma.examAttempt.count({ where: { id: attemptId } });
      if (!exists) throw new NotFoundException('Urinish topilmadi');
    }

    const graded: Awaited<ReturnType<ScoringService['gradeObjectiveSection']>>[] = [];
    for (const s of sections) graded.push(await this.gradeObjectiveSection(s.id));

    const result = await this.syncAttemptScores(attemptId);
    return { graded, result };
  }
}
