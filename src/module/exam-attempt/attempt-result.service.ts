import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttemptStatus, Prisma, Role, Skill } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AiEvaluationService } from '../ai-evaluation/ai-evaluation.service';
import { ListAttemptsQueryDto } from './dto/list-attempts-query.dto';

@Injectable()
export class AttemptResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiEvaluationService,
  ) {}

  private get showCorrect() {
    return process.env.EXAM_SHOW_CORRECT_ANSWERS !== 'false';
  }

  private readonly listSelect = {
    id: true,
    status: true,
    startedAt: true,
    finishedAt: true,
    totalScore: true,
    cefrLevel: true,
    listeningScore: true,
    readingScore: true,
    writingScore: true,
    speakingScore: true,
    exam: { select: { id: true, title: true, type: true } },
  } satisfies Prisma.ExamAttemptSelect;

  /** Talabaning o'z urinishlari */
  async listMine(user: AuthUser, q: ListAttemptsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Prisma.ExamAttemptWhereInput = {
      userId: user.id,
      ...(q.status && { status: q.status }),
      ...(q.examId && { examId: q.examId }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.examAttempt.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: this.listSelect,
      }),
      this.prisma.examAttempt.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Admin: hammasi. O'qituvchi: faqat o'z imtihonlari urinishlari. */
  async listAll(user: AuthUser, q: ListAttemptsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Prisma.ExamAttemptWhereInput = {
      ...(user.role === Role.TEACHER && { exam: { createdById: user.id } }),
      ...(q.status && { status: q.status }),
      ...(q.examId && { examId: q.examId }),
      ...(q.userId && { userId: q.userId }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.examAttempt.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { ...this.listSelect, user: { select: { id: true, name: true, phone: true } } },
      }),
      this.prisma.examAttempt.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Natija: egasi yoki (o'z imtihoni bo'yicha) o'qituvchi / admin ko'ra oladi */
  async getResult(user: AuthUser, attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        userId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        totalScore: true,
        cefrLevel: true,
        listeningScore: true,
        readingScore: true,
        writingScore: true,
        speakingScore: true,
        user: { select: { id: true, name: true, phone: true } },
        exam: { select: { id: true, title: true, type: true, createdById: true } },
        sections: {
          select: {
            id: true,
            sectionId: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            rawScore: true,
            score: true,
            maxScore: true,
            aiSummary: true,
            section: { select: { skill: true, order: true, title: true } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Urinish topilmadi');

    const isOwner = attempt.userId === user.id;
    const isStaff = user.role === Role.ADMIN || (user.role === Role.TEACHER && attempt.exam.createdById === user.id);
    if (!isOwner && !isStaff) throw new NotFoundException('Urinish topilmadi');
    if (isOwner && !isStaff && attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new ConflictException('Imtihon hali yakunlanmagan');
    }

    const sections = [...attempt.sections]
      .sort((a, b) => a.section.order - b.section.order)
      .map((s) => ({
        sectionId: s.sectionId,
        skill: s.section.skill,
        title: s.section.title,
        status: s.status,
        rawScore: s.rawScore,
        score: s.score,
        maxScore: s.maxScore,
        skipped: !!(s.aiSummary && typeof s.aiSummary === 'object' && (s.aiSummary as { skipped?: boolean }).skipped),
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
      }));

    const pending = sections.some((s) => s.status !== AttemptStatus.COMPLETED) || attempt.status !== AttemptStatus.COMPLETED;
    const evaluations = await this.ai.getForAttempt(attemptId);
    const review = await this.buildReview(attempt.sections.filter((s) => s.section.skill === Skill.LISTENING || s.section.skill === Skill.READING));

    return {
      attemptId: attempt.id,
      status: attempt.status,
      pending,
      user: isStaff ? attempt.user : undefined,
      exam: { id: attempt.exam.id, title: attempt.exam.title, type: attempt.exam.type },
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      scores: {
        listening: attempt.listeningScore,
        reading: attempt.readingScore,
        writing: attempt.writingScore,
        speaking: attempt.speakingScore,
        total: attempt.totalScore,
        cefr: attempt.cefrLevel,
      },
      sections,
      review,
      evaluations,
    };
  }

  /** Listening / Reading: har bir savol, talaba javobi, to'g'ri/noto'g'ri (va to'g'ri javob) */
  private async buildReview(sas: { id: string; sectionId: string; section: { skill: Skill; title: string | null } }[]) {
    if (sas.length === 0) return [];
    const reveal = this.showCorrect;

    const sectionRows = await this.prisma.examSection.findMany({
      where: { id: { in: sas.map((s) => s.sectionId) } },
      select: {
        id: true,
        parts: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            options: { select: { id: true, label: true, text: true } },
            questions: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                number: true,
                type: true,
                text: true,
                points: true,
                acceptedAnswers: true,
                correctPartOptionId: true,
                explanation: true,
                options: { orderBy: { label: 'asc' }, select: { id: true, label: true, text: true, isCorrect: true } },
              },
            },
          },
        },
      },
    });
    const answers = await this.prisma.answer.findMany({
      where: { sectionAttemptId: { in: sas.map((s) => s.id) } },
      select: {
        sectionAttemptId: true,
        questionId: true,
        selectedOptionId: true,
        selectedPartOptionId: true,
        textAnswer: true,
        isCorrect: true,
        pointsAwarded: true,
      },
    });
    const ansMap = new Map(answers.map((a) => [`${a.sectionAttemptId}:${a.questionId}`, a]));

    return sas.map((sa) => {
      const row = sectionRows.find((r) => r.id === sa.sectionId);
      return {
        sectionId: sa.sectionId,
        skill: sa.section.skill,
        parts: (row?.parts ?? []).map((p) => ({
          partId: p.id,
          title: p.title,
          questions: p.questions.map((q) => {
            const a = ansMap.get(`${sa.id}:${q.id}`);
            const chosenOption = q.options.find((o) => o.id === a?.selectedOptionId);
            const chosenPart = p.options.find((o) => o.id === a?.selectedPartOptionId);
            const correctOptions = q.options.filter((o) => o.isCorrect).map((o) => ({ id: o.id, label: o.label, text: o.text }));
            const correctPart = p.options.find((o) => o.id === q.correctPartOptionId);
            return {
              questionId: q.id,
              number: q.number,
              type: q.type,
              text: q.text,
              points: q.points,
              answered: !!a,
              yourAnswer: a ? { option: chosenOption ? { id: chosenOption.id, label: chosenOption.label, text: chosenOption.text } : null, partOption: chosenPart ?? null, text: a.textAnswer } : null,
              isCorrect: a?.isCorrect ?? false,
              pointsAwarded: a?.pointsAwarded ?? 0,
              correct: reveal
                ? { options: correctOptions, partOption: correctPart ?? null, acceptedAnswers: q.acceptedAnswers }
                : undefined,
              explanation: reveal ? q.explanation : undefined,
            };
          }),
        })),
      };
    });
  }
}
