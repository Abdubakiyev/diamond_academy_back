import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FileKind, PartFormat, Prisma, QuestionType, Skill } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ExamPartService } from '../exam-part/exam-part.service';
import { EXAM_AUDIO_PREFIX, EXAM_IMAGE_PREFIX, FORMAT_QUESTION_TYPES } from '../exam-part/part-rules';
import { StorageService } from '../storage/storage.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { CreateQuestionDto, CreateQuestionsBulkDto } from './dto/create-questions.dto';
import { QuestionInputDto } from './dto/question-input.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

type PartCtx = {
  id: string;
  format: PartFormat;
  sectionId: string;
  options: { id: string; label: string }[];
  section: { skill: Skill; examId: string };
};

/** Tekshirishdan oldingi umumiy ko'rinish (yaratish ham, tahrirlash ham shu orqali o'tadi) */
type QInput = {
  type: QuestionType;
  text: string;
  points?: number;
  options?: { label?: string; text: string; isCorrect: boolean }[];
  correctPartOptionLabel?: string | null;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  audioKey?: string | null;
  prepTimeSec?: number | null;
  answerTimeSec?: number | null;
  minWords?: number | null;
  maxWords?: number | null;
  rubric?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  explanation?: string | null;
};

const TFNG_VALUES = ['TRUE', 'FALSE', 'NOT_GIVEN'];

@Injectable()
export class QuestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parts: ExamPartService,
    private readonly storage: StorageService,
  ) {}

  /* ───────────── Yordamchilar ───────────── */

  private async getManageableQuestion(user: AuthUser, id: string) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { label: 'asc' } },
        correctPartOption: { select: { label: true } },
      },
    });
    if (!q) throw new NotFoundException('Savol topilmadi');
    const part = await this.parts.getManageablePart(user, q.partId);
    return { q, part };
  }

  /** Savolni turiga va part formatiga qarab tekshiradi, bazaga yoziladigan ko'rinishga keltiradi */
  normalize(part: PartCtx, q: QInput) {
    const allowed = FORMAT_QUESTION_TYPES[part.format];
    if (!allowed.includes(q.type)) {
      throw new BadRequestException(
        `${part.format} partida ${q.type} savolini ishlatib bo‘lmaydi. Ruxsat etilgan: ${allowed.join(', ')}`,
      );
    }

    const text = q.text.trim();
    if (!text) throw new BadRequestException('Savol matni bo‘sh bo‘lmasligi kerak');

    if (q.audioKey && !q.audioKey.startsWith(EXAM_AUDIO_PREFIX)) {
      throw new BadRequestException('Audio kaliti noto‘g‘ri. Avval POST /storage/presign (EXAM_AUDIO) orqali yuklang');
    }

    let options: { label: string; text: string; isCorrect: boolean }[] = [];
    let acceptedAnswers: string[] = [];
    let correctPartOptionId: string | null = null;

    switch (q.type) {
      case QuestionType.MULTIPLE_CHOICE: {
        const list = q.options ?? [];
        if (list.length < 2) throw new BadRequestException('Kamida 2 ta variant kerak');
        options = list.map((o, i) => ({
          label: o.label ?? String.fromCharCode(65 + i),
          text: o.text.trim(),
          isCorrect: o.isCorrect,
        }));
        if (options.some((o) => !o.text)) throw new BadRequestException('Variant matni bo‘sh bo‘lmasligi kerak');
        if (new Set(options.map((o) => o.label)).size !== options.length) {
          throw new BadRequestException('Variant harflari takrorlangan');
        }
        if (options.filter((o) => o.isCorrect).length !== 1) {
          throw new BadRequestException('Aynan bitta variant to‘g‘ri (isCorrect: true) bo‘lishi kerak');
        }
        break;
      }

      case QuestionType.TRUE_FALSE_NG: {
        const values = [...new Set((q.acceptedAnswers ?? []).map((a) => a.trim().toUpperCase().replace(/[\s-]+/g, '_')))];
        if (values.length !== 1 || !TFNG_VALUES.includes(values[0])) {
          throw new BadRequestException('acceptedAnswers aynan bitta qiymat bo‘lishi kerak: TRUE, FALSE yoki NOT_GIVEN');
        }
        acceptedAnswers = values;
        break;
      }

      case QuestionType.SHORT_ANSWER: {
        acceptedAnswers = [...new Set((q.acceptedAnswers ?? []).map((a) => a.trim()).filter(Boolean))];
        if (acceptedAnswers.length === 0) throw new BadRequestException('Kamida bitta to‘g‘ri javob (acceptedAnswers) kerak');
        break;
      }

      case QuestionType.MATCHING: {
        if (part.options.length === 0) {
          throw new BadRequestException('Avval partga variantlar bankini kiriting (PUT /exam-part/:id/options)');
        }
        if (!q.correctPartOptionLabel) throw new BadRequestException('correctPartOptionLabel kerak (masalan "C")');
        const option = part.options.find((o) => o.label === q.correctPartOptionLabel);
        if (!option) throw new BadRequestException(`${q.correctPartOptionLabel} varianti partning bankida yo‘q`);
        correctPartOptionId = option.id;
        break;
      }

      case QuestionType.WRITING_PROMPT: {
        if (q.minWords && q.maxWords && q.minWords > q.maxWords) {
          throw new BadRequestException('minWords maxWords dan katta bo‘lmasligi kerak');
        }
        break;
      }

      case QuestionType.SPEAKING_PROMPT:
        break;
    }

    const isWriting = q.type === QuestionType.WRITING_PROMPT;
    const isSpeaking = q.type === QuestionType.SPEAKING_PROMPT;

    return {
      type: q.type,
      text,
      points: q.points ?? 1,
      audioKey: q.audioKey ?? null,
      audioUrl: q.audioKey ? this.storage.publicUrl(q.audioKey) : null,
      correctPartOptionId,
      acceptedAnswers,
      caseSensitive: q.caseSensitive ?? false,
      prepTimeSec: isSpeaking ? (q.prepTimeSec ?? null) : null,
      answerTimeSec: isSpeaking ? (q.answerTimeSec ?? null) : null,
      minWords: isWriting ? (q.minWords ?? null) : null,
      maxWords: isWriting ? (q.maxWords ?? null) : null,
      rubric: isWriting || isSpeaking ? (q.rubric ?? null) : null,
      meta: q.meta ?? null,
      explanation: q.explanation?.trim() || null,
      options,
    };
  }

  /** normalize() natijasidan Prisma `data` (options alohida) */
  private toData(n: ReturnType<QuestionService['normalize']>) {
    const { options, rubric, meta, ...rest } = n;
    return {
      ...rest,
      rubric: (rubric as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
      meta: (meta as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
    };
  }

  private isHttpUrl(value: string) {
    try {
      const u = new URL(value.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /* ───────────── Yaratish ───────────── */

  async createMany(user: AuthUser, partId: string, inputs: QuestionInputDto[]) {
    const part = await this.parts.getManageablePart(user, partId);
    await this.parts.assertStructureEditable(part.section.examId);

    const normalized = inputs.map((input, i) => {
      try {
        return this.normalize(part, input);
      } catch (e) {
        if (e instanceof BadRequestException) {
          throw new BadRequestException(`Savol #${i + 1}: ${e.message}`);
        }
        throw e;
      }
    });

    const agg = await this.prisma.question.aggregate({ where: { partId }, _max: { order: true } });
    const startOrder = (agg._max.order ?? 0) + 1;

    const created = await this.prisma.$transaction(
      normalized.map((n, i) =>
        this.prisma.question.create({
          data: {
            partId,
            order: startOrder + i,
            ...this.toData(n),
            options: n.options.length > 0 ? { create: n.options } : undefined,
          },
          select: { id: true },
        }),
      ),
    );

    await this.parts.renumberSection(part.sectionId);

    return this.prisma.question.findMany({
      where: { id: { in: created.map((c) => c.id) } },
      orderBy: { order: 'asc' },
      include: {
        options: { orderBy: { label: 'asc' } },
        correctPartOption: { select: { id: true, label: true } },
      },
    });
  }

  async create(user: AuthUser, dto: CreateQuestionDto) {
    const { partId, ...input } = dto;
    const [question] = await this.createMany(user, partId, [input]);
    return question;
  }

  async createBulk(user: AuthUser, dto: CreateQuestionsBulkDto) {
    return this.createMany(user, dto.partId, dto.questions);
  }

  /* ───────────── Ko'rish / tahrirlash / o'chirish ───────────── */

  async findOne(user: AuthUser, id: string) {
    await this.getManageableQuestion(user, id);
    return this.prisma.question.findUniqueOrThrow({
      where: { id },
      include: {
        options: { orderBy: { label: 'asc' } },
        media: { orderBy: { order: 'asc' } },
        correctPartOption: { select: { id: true, label: true } },
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateQuestionDto) {
    const { q, part } = await this.getManageableQuestion(user, id);

    const typeChanged = dto.type !== undefined && dto.type !== q.type;
    const optionsChanged = dto.options !== undefined || typeChanged;
    // Tur yoki variantlar o'zgarsa, topshirilgan javoblar ma'nosini yo'qotadi
    if (optionsChanged) await this.parts.assertStructureEditable(part.section.examId);

    const merged: QInput = {
      type: dto.type ?? q.type,
      text: dto.text ?? q.text,
      points: dto.points ?? q.points,
      options:
        dto.options ??
        (typeChanged ? undefined : q.options.map((o) => ({ label: o.label, text: o.text, isCorrect: o.isCorrect }))),
      correctPartOptionLabel:
        dto.correctPartOptionLabel !== undefined
          ? dto.correctPartOptionLabel
          : typeChanged
            ? undefined
            : (q.correctPartOption?.label ?? null),
      acceptedAnswers: dto.acceptedAnswers ?? (typeChanged ? undefined : q.acceptedAnswers),
      caseSensitive: dto.caseSensitive ?? q.caseSensitive,
      audioKey: dto.audioKey !== undefined ? dto.audioKey : q.audioKey,
      prepTimeSec: dto.prepTimeSec !== undefined ? dto.prepTimeSec : q.prepTimeSec,
      answerTimeSec: dto.answerTimeSec !== undefined ? dto.answerTimeSec : q.answerTimeSec,
      minWords: dto.minWords !== undefined ? dto.minWords : q.minWords,
      maxWords: dto.maxWords !== undefined ? dto.maxWords : q.maxWords,
      rubric: dto.rubric !== undefined ? dto.rubric : (q.rubric as Record<string, unknown> | null),
      meta: dto.meta !== undefined ? dto.meta : (q.meta as Record<string, unknown> | null),
      explanation: dto.explanation !== undefined ? dto.explanation : q.explanation,
    };

    const n = this.normalize(part, merged);

    await this.prisma.$transaction(async (tx) => {
      if (optionsChanged) await tx.questionOption.deleteMany({ where: { questionId: id } });
      await tx.question.update({
        where: { id },
        data: {
          ...this.toData(n),
          options: optionsChanged && n.options.length > 0 ? { create: n.options } : undefined,
        },
      });
    });

    if (q.audioKey && q.audioKey !== n.audioKey) await this.storage.remove(q.audioKey);

    return this.findOne(user, id);
  }

  async remove(user: AuthUser, id: string) {
    const { q, part } = await this.getManageableQuestion(user, id);
    await this.parts.assertStructureEditable(part.section.examId);

    const media = await this.prisma.questionMedia.findMany({ where: { questionId: id }, select: { storageKey: true } });

    await this.prisma.question.delete({ where: { id } });
    await this.parts.renumberSection(part.sectionId);

    const keys = [q.audioKey, ...media.map((m) => m.storageKey)].filter((k): k is string => !!k);
    await Promise.allSettled(keys.map((k) => this.storage.remove(k)));
    return { deleted: true };
  }

  /** (partId, order) unique bo'lgani uchun avval vaqtinchalik manfiy raqamlar beriladi */
  async reorder(user: AuthUser, dto: ReorderQuestionsDto) {
    const part = await this.parts.getManageablePart(user, dto.partId);
    await this.parts.assertStructureEditable(part.section.examId);

    const existing = await this.prisma.question.findMany({ where: { partId: dto.partId }, select: { id: true } });
    const ids = new Set(existing.map((e) => e.id));
    if (ids.size !== dto.questionIds.length || !dto.questionIds.every((id) => ids.has(id))) {
      throw new BadRequestException('questionIds partdagi barcha savollarni aynan bir martadan o‘z ichiga olishi kerak');
    }

    await this.prisma.$transaction([
      ...dto.questionIds.map((id, i) => this.prisma.question.update({ where: { id }, data: { order: -(i + 1) } })),
      ...dto.questionIds.map((id, i) => this.prisma.question.update({ where: { id }, data: { order: i + 1 } })),
    ]);
    await this.parts.renumberSection(part.sectionId);

    return this.prisma.question.findMany({
      where: { partId: dto.partId },
      orderBy: { order: 'asc' },
      select: { id: true, order: true, number: true, type: true, text: true },
    });
  }

  /* ───────────── Media (rasm / audio) ───────────── */

  async addMedia(user: AuthUser, questionId: string, dto: CreateMediaDto) {
    await this.getManageableQuestion(user, questionId);

    if (!dto.storageKey && !dto.url) throw new BadRequestException('storageKey yoki url kerak');
    if (dto.url && !this.isHttpUrl(dto.url)) throw new BadRequestException('url noto‘g‘ri (http yoki https bo‘lishi kerak)');
    if (dto.storageKey && !dto.storageKey.startsWith(EXAM_IMAGE_PREFIX) && !dto.storageKey.startsWith(EXAM_AUDIO_PREFIX)) {
      throw new BadRequestException('storageKey noto‘g‘ri. Avval POST /storage/presign (EXAM_IMAGE yoki EXAM_AUDIO) orqali yuklang');
    }

    const kind = dto.kind ?? (dto.storageKey?.startsWith(EXAM_AUDIO_PREFIX) ? FileKind.AUDIO : FileKind.IMAGE);

    let order = dto.order;
    if (order === undefined) {
      const agg = await this.prisma.questionMedia.aggregate({ where: { questionId }, _max: { order: true } });
      order = (agg._max.order ?? -1) + 1;
    }

    return this.prisma.questionMedia.create({
      data: {
        questionId,
        kind,
        url: dto.url ?? (dto.storageKey ? (this.storage.publicUrl(dto.storageKey) ?? dto.storageKey) : ''),
        storageKey: dto.storageKey,
        caption: dto.caption,
        order,
      },
    });
  }

  async removeMedia(user: AuthUser, mediaId: string) {
    const media = await this.prisma.questionMedia.findUnique({
      where: { id: mediaId },
      include: { question: { select: { partId: true } } },
    });
    if (!media) throw new NotFoundException('Media topilmadi');
    await this.parts.getManageablePart(user, media.question.partId);

    await this.prisma.questionMedia.delete({ where: { id: mediaId } });
    await this.storage.remove(media.storageKey);
    return { deleted: true };
  }
}
