import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Skill } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const READ_URL_TTL = 6 * 60 * 60;
const AUDIO_URL_TTL = 20 * 60;

type Plays = Record<string, number>;

const readPlays = (summary: Prisma.JsonValue | null): Plays => {
  if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
    const plays = (summary as Record<string, unknown>).audioPlays;
    if (plays && typeof plays === 'object') return { ...(plays as Plays) };
  }
  return {};
};

/** Talabaga ko'rsatiladigan bo'lim mazmuni (to'g'ri javoblarsiz) va Listening audiosini eshittirish nazorati */
@Injectable()
export class SectionContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async resolve(url: string | null, key: string | null, ttl = READ_URL_TTL): Promise<string | null> {
    if (key) {
      const pub = this.storage.publicUrl(key);
      if (pub) return pub;
      try {
        return await this.storage.getReadUrl(key, ttl);
      } catch {
        return url;
      }
    }
    return url;
  }

  /** Bo'lim savollari + talabaning saqlangan javoblari. isCorrect, acceptedAnswers, rubric, explanation CHIQMAYDI. */
  async buildContent(sectionId: string, sectionAttemptId: string) {
    const [section, sa, answers] = await Promise.all([
      this.prisma.examSection.findUnique({
        where: { id: sectionId },
        select: {
          id: true,
          skill: true,
          title: true,
          instructions: true,
          timeLimitSec: true,
          parts: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              title: true,
              instructions: true,
              format: true,
              passageText: true,
              imageUrl: true,
              imageKey: true,
              timeLimitSec: true,
              prepTimeSec: true,
              answerTimeSec: true,
              audioPlayLimit: true,
              audioUrl: true,
              audioKey: true,
              meta: true,
              options: { orderBy: { label: 'asc' }, select: { id: true, label: true, text: true, imageUrl: true } },
              questions: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  number: true,
                  order: true,
                  type: true,
                  text: true,
                  points: true,
                  minWords: true,
                  maxWords: true,
                  prepTimeSec: true,
                  answerTimeSec: true,
                  meta: true,
                  audioUrl: true,
                  audioKey: true,
                  options: { orderBy: { label: 'asc' }, select: { id: true, label: true, text: true } },
                  media: { orderBy: { order: 'asc' }, select: { id: true, kind: true, url: true, storageKey: true, caption: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.sectionAttempt.findUnique({ where: { id: sectionAttemptId }, select: { aiSummary: true } }),
      this.prisma.answer.findMany({
        where: { sectionAttemptId },
        select: { questionId: true, selectedOptionId: true, selectedPartOptionId: true, textAnswer: true, audioKey: true, durationSec: true },
      }),
    ]);
    if (!section) throw new NotFoundException('Bo‘lim topilmadi');

    const plays = readPlays(sa?.aiSummary ?? null);
    const listening = section.skill === Skill.LISTENING;

    const parts = await Promise.all(
      section.parts.map(async (p) => ({
        id: p.id,
        order: p.order,
        title: p.title,
        instructions: p.instructions,
        format: p.format,
        passageText: p.passageText,
        imageUrl: await this.resolve(p.imageUrl, p.imageKey),
        timeLimitSec: p.timeLimitSec,
        prepTimeSec: p.prepTimeSec,
        answerTimeSec: p.answerTimeSec,
        meta: p.meta,
        // Audio havolasi bu yerda berilmaydi: POST /exam-attempt/:id/audio orqali, limit hisobi bilan olinadi
        audio: listening && (p.audioKey || p.audioUrl) ? { playLimit: p.audioPlayLimit, played: plays[`p:${p.id}`] ?? 0 } : null,
        options: p.options,
        questions: await Promise.all(
          p.questions.map(async (q) => ({
            id: q.id,
            number: q.number,
            order: q.order,
            type: q.type,
            text: q.text,
            points: q.points,
            minWords: q.minWords,
            maxWords: q.maxWords,
            prepTimeSec: q.prepTimeSec,
            answerTimeSec: q.answerTimeSec,
            meta: q.meta,
            audio:
              listening && (q.audioKey || q.audioUrl) ? { playLimit: p.audioPlayLimit, played: plays[`q:${q.id}`] ?? 0 } : null,
            options: q.options,
            media: await Promise.all(
              q.media.map(async (m) => ({ id: m.id, kind: m.kind, caption: m.caption, url: await this.resolve(m.url, m.storageKey) })),
            ),
          })),
        ),
      })),
    );

    return {
      section: { id: section.id, skill: section.skill, title: section.title, instructions: section.instructions, timeLimitSec: section.timeLimitSec },
      parts,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        selectedPartOptionId: a.selectedPartOptionId,
        textAnswer: a.textAnswer,
        hasAudio: !!a.audioKey,
        durationSec: a.durationSec,
      })),
    };
  }

  /**
   * Listening audiosi uchun havola beradi va eshittirish sonini hisoblaydi (partning audioPlayLimit i bo'yicha).
   * DIQQAT: server havola berish sonini cheklaydi. Havola 20 daqiqa amal qiladi; pleyerning o'zida
   * "qayta eshittirish yo'q" qoidasi frontendda ham bo'lishi kerak. Ochiq (public) bucketda havolani cheklab bo'lmaydi.
   */
  async issueAudio(sectionAttemptId: string, sectionId: string, target: { partId?: string; questionId?: string }) {
    let key: string;
    let audioKey: string | null;
    let audioUrl: string | null;
    let limit: number;

    if (target.partId) {
      const part = await this.prisma.examPart.findFirst({
        where: { id: target.partId, sectionId },
        select: { audioKey: true, audioUrl: true, audioPlayLimit: true },
      });
      if (!part || (!part.audioKey && !part.audioUrl)) throw new NotFoundException('Audio topilmadi');
      key = `p:${target.partId}`;
      ({ audioKey, audioUrl } = part);
      limit = part.audioPlayLimit;
    } else if (target.questionId) {
      const q = await this.prisma.question.findFirst({
        where: { id: target.questionId, part: { sectionId } },
        select: { audioKey: true, audioUrl: true, part: { select: { audioPlayLimit: true } } },
      });
      if (!q || (!q.audioKey && !q.audioUrl)) throw new NotFoundException('Audio topilmadi');
      key = `q:${target.questionId}`;
      ({ audioKey, audioUrl } = q);
      limit = q.part.audioPlayLimit;
    } else {
      throw new NotFoundException('partId yoki questionId kerak');
    }

    const played = await this.prisma.$transaction(async (tx) => {
      const sa = await tx.sectionAttempt.findUniqueOrThrow({ where: { id: sectionAttemptId }, select: { aiSummary: true } });
      const plays = readPlays(sa.aiSummary);
      const count = plays[key] ?? 0;
      if (count >= limit) throw new ConflictException('Audio eshittirish limiti tugagan');
      plays[key] = count + 1;

      const base =
        sa.aiSummary && typeof sa.aiSummary === 'object' && !Array.isArray(sa.aiSummary) ? (sa.aiSummary as Record<string, unknown>) : {};
      await tx.sectionAttempt.update({
        where: { id: sectionAttemptId },
        data: { aiSummary: { ...base, audioPlays: plays } as Prisma.InputJsonValue },
      });
      return count + 1;
    });

    const url = await this.resolve(audioUrl, audioKey, AUDIO_URL_TTL);
    return { url, played, playLimit: limit, remaining: limit - played, urlExpiresInSec: AUDIO_URL_TTL };
  }
}
