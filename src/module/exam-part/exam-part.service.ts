import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PartFormat, Prisma, QuestionType, Skill } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ExamService } from '../exam/exam.service';
import { StorageService } from '../storage/storage.service';
import { CreatePartDto } from './dto/create-part.dto';
import { ReorderPartsDto } from './dto/reorder-parts.dto';
import { SetPartOptionsDto } from './dto/set-part-options.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { BANK_FORMATS, EXAM_AUDIO_PREFIX, EXAM_IMAGE_PREFIX, SKILL_FORMATS } from './part-rules';

const READ_URL_TTL = 6 * 60 * 60;

@Injectable()
export class ExamPartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExamService,
    private readonly storage: StorageService,
  ) {}

  /* ───────────── Yordamchilar ───────────── */

  /** Partni (bank variantlari bilan) topadi va imtihon bo'yicha huquqni tekshiradi. Savol moduli ham ishlatadi. */
  async getManageablePart(user: AuthUser, partId: string) {
    const part = await this.prisma.examPart.findUnique({
      where: { id: partId },
      include: {
        options: { orderBy: { label: 'asc' } },
        section: { select: { id: true, skill: true, examId: true } },
      },
    });
    if (!part) throw new NotFoundException('Part topilmadi');
    await this.exams.getManageableExam(user, part.section.examId); // huquq tekshiruvi
    return part;
  }

  /** Urinishlar bo'lgan imtihonda tuzilmani (part / savol qo'shish, o'chirish, tartib) o'zgartirib bo'lmaydi */
  async assertStructureEditable(examId: string) {
    const attempts = await this.prisma.examAttempt.count({ where: { examId } });
    if (attempts > 0) {
      throw new ConflictException('Bu imtihonda urinishlar bor, tuzilmani o‘zgartirib bo‘lmaydi. Yangi imtihon yarating');
    }
  }

  private assertFormatAllowed(skill: Skill, format: PartFormat) {
    if (!SKILL_FORMATS[skill].includes(format)) {
      throw new BadRequestException(
        `${skill} bo‘limida ${format} formatini ishlatib bo‘lmaydi. Ruxsat etilgan: ${SKILL_FORMATS[skill].join(', ')}`,
      );
    }
  }

  private assertAudioKey(skill: Skill, key: string) {
    if (skill !== Skill.LISTENING) throw new BadRequestException('Audio faqat Listening partiga biriktiriladi');
    if (!key.startsWith(EXAM_AUDIO_PREFIX)) {
      throw new BadRequestException('Audio kaliti noto‘g‘ri. Avval POST /storage/presign (EXAM_AUDIO) orqali yuklang');
    }
  }

  private assertImageKey(key: string) {
    if (!key.startsWith(EXAM_IMAGE_PREFIX)) {
      throw new BadRequestException('Rasm kaliti noto‘g‘ri. Avval POST /storage/presign (EXAM_IMAGE) orqali yuklang');
    }
  }

  private assertSpeakingTimes(skill: Skill, prep?: number | null, answer?: number | null) {
    if (skill !== Skill.SPEAKING && (prep || answer)) {
      throw new BadRequestException('prepTimeSec va answerTimeSec faqat Speaking uchun');
    }
  }

  private async resolveUrl(url: string | null, key: string | null) {
    if (url || !key) return url;
    try {
      return await this.storage.getReadUrl(key, READ_URL_TTL);
    } catch {
      return null;
    }
  }

  private isHttpUrl(value: string) {
    try {
      const u = new URL(value.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /** Bo'limdagi savollarga ketma-ket raqam (Q1, Q2 ...) beradi: partlar tartibi, keyin savollar tartibi bo'yicha */
  async renumberSection(sectionId: string) {
    const parts = await this.prisma.examPart.findMany({
      where: { sectionId },
      orderBy: { order: 'asc' },
      select: {
        questions: { orderBy: { order: 'asc' }, select: { id: true, number: true } },
      },
    });

    const updates: Prisma.PrismaPromise<unknown>[] = [];
    let n = 1;
    for (const part of parts) {
      for (const q of part.questions) {
        if (q.number !== n) updates.push(this.prisma.question.update({ where: { id: q.id }, data: { number: n } }));
        n++;
      }
    }
    if (updates.length > 0) await this.prisma.$transaction(updates);
  }

  /* ───────────── Part CRUD ───────────── */

  async create(user: AuthUser, dto: CreatePartDto) {
    const section = await this.exams.getManageableSection(user, dto.sectionId);
    await this.assertStructureEditable(section.examId);

    this.assertFormatAllowed(section.skill, dto.format);
    this.assertSpeakingTimes(section.skill, dto.prepTimeSec, dto.answerTimeSec);
    if (dto.audioKey) this.assertAudioKey(section.skill, dto.audioKey);
    if (dto.imageKey) this.assertImageKey(dto.imageKey);

    const agg = await this.prisma.examPart.aggregate({ where: { sectionId: dto.sectionId }, _max: { order: true } });
    const order = (agg._max.order ?? 0) + 1;

    return this.prisma.examPart.create({
      data: {
        sectionId: dto.sectionId,
        order,
        title: dto.title?.trim() || `Part ${order}`,
        instructions: dto.instructions,
        format: dto.format,
        meta: dto.meta as Prisma.InputJsonValue | undefined,
        audioKey: dto.audioKey,
        audioUrl: dto.audioKey ? this.storage.publicUrl(dto.audioKey) : undefined,
        audioPlayLimit: dto.audioPlayLimit,
        passageText: dto.passageText,
        imageKey: dto.imageKey,
        imageUrl: dto.imageKey ? this.storage.publicUrl(dto.imageKey) : undefined,
        timeLimitSec: dto.timeLimitSec,
        prepTimeSec: dto.prepTimeSec,
        answerTimeSec: dto.answerTimeSec,
      },
    });
  }

  /** Admin / o'qituvchi uchun partning to'liq ko'rinishi (to'g'ri javoblar bilan) */
  async findOne(user: AuthUser, id: string) {
    await this.getManageablePart(user, id);

    const part = await this.prisma.examPart.findUniqueOrThrow({
      where: { id },
      include: {
        options: { orderBy: { label: 'asc' } },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: { orderBy: { label: 'asc' } },
            media: { orderBy: { order: 'asc' } },
            correctPartOption: { select: { id: true, label: true } },
          },
        },
      },
    });

    const [audioPlayUrl, imagePlayUrl] = await Promise.all([
      this.resolveUrl(part.audioUrl, part.audioKey),
      this.resolveUrl(part.imageUrl, part.imageKey),
    ]);
    return { ...part, audioUrl: audioPlayUrl, imageUrl: imagePlayUrl };
  }

  async update(user: AuthUser, id: string, dto: UpdatePartDto) {
    const part = await this.getManageablePart(user, id);
    const skill = part.section.skill;

    if (dto.format && dto.format !== part.format) {
      this.assertFormatAllowed(skill, dto.format);
      const count = await this.prisma.question.count({ where: { partId: id } });
      if (count > 0) throw new BadRequestException('Partda savollar bor, formatni o‘zgartirib bo‘lmaydi. Avval savollarni o‘chiring');
    }
    this.assertSpeakingTimes(skill, dto.prepTimeSec, dto.answerTimeSec);

    const data: Prisma.ExamPartUncheckedUpdateInput = {
      format: dto.format,
      title: dto.title === null ? null : dto.title?.trim(),
      instructions: dto.instructions,
      audioPlayLimit: dto.audioPlayLimit,
      passageText: dto.passageText,
      timeLimitSec: dto.timeLimitSec,
      prepTimeSec: dto.prepTimeSec,
      answerTimeSec: dto.answerTimeSec,
      meta: dto.meta === null ? Prisma.DbNull : (dto.meta as Prisma.InputJsonValue | undefined),
    };

    const removeKeys: string[] = [];

    if (dto.audioKey !== undefined) {
      if (dto.audioKey === null) {
        data.audioKey = null;
        data.audioUrl = null;
      } else {
        this.assertAudioKey(skill, dto.audioKey);
        data.audioKey = dto.audioKey;
        data.audioUrl = this.storage.publicUrl(dto.audioKey);
      }
      if (part.audioKey && part.audioKey !== dto.audioKey) removeKeys.push(part.audioKey);
    }

    if (dto.imageKey !== undefined) {
      if (dto.imageKey === null) {
        data.imageKey = null;
        data.imageUrl = null;
      } else {
        this.assertImageKey(dto.imageKey);
        data.imageKey = dto.imageKey;
        data.imageUrl = this.storage.publicUrl(dto.imageKey);
      }
      if (part.imageKey && part.imageKey !== dto.imageKey) removeKeys.push(part.imageKey);
    }

    const updated = await this.prisma.examPart.update({ where: { id }, data });
    await Promise.allSettled(removeKeys.map((k) => this.storage.remove(k)));
    return updated;
  }

  /** Diqqat: part o'chsa, uning savollari, variantlari va fayllari ham o'chadi */
  async remove(user: AuthUser, id: string) {
    const part = await this.getManageablePart(user, id);
    await this.assertStructureEditable(part.section.examId);

    const [questions, media] = await Promise.all([
      this.prisma.question.findMany({ where: { partId: id }, select: { audioKey: true } }),
      this.prisma.questionMedia.findMany({ where: { question: { partId: id } }, select: { storageKey: true } }),
    ]);

    await this.prisma.examPart.delete({ where: { id } });
    await this.renumberSection(part.sectionId);

    const keys = [part.audioKey, part.imageKey, ...questions.map((q) => q.audioKey), ...media.map((m) => m.storageKey)].filter(
      (k): k is string => !!k,
    );
    await Promise.allSettled(keys.map((k) => this.storage.remove(k)));
    return { deleted: true };
  }

  /** (sectionId, order) unique bo'lgani uchun avval vaqtinchalik manfiy raqamlar beriladi */
  async reorder(user: AuthUser, dto: ReorderPartsDto) {
    const section = await this.exams.getManageableSection(user, dto.sectionId);
    await this.assertStructureEditable(section.examId);

    const existing = await this.prisma.examPart.findMany({ where: { sectionId: dto.sectionId }, select: { id: true } });
    const ids = new Set(existing.map((p) => p.id));
    if (ids.size !== dto.partIds.length || !dto.partIds.every((id) => ids.has(id))) {
      throw new BadRequestException('partIds bo‘limdagi barcha partlarni aynan bir martadan o‘z ichiga olishi kerak');
    }

    await this.prisma.$transaction([
      ...dto.partIds.map((id, i) => this.prisma.examPart.update({ where: { id }, data: { order: -(i + 1) } })),
      ...dto.partIds.map((id, i) => this.prisma.examPart.update({ where: { id }, data: { order: i + 1 } })),
    ]);
    await this.renumberSection(dto.sectionId);

    return this.prisma.examPart.findMany({
      where: { sectionId: dto.sectionId },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, order: true, format: true },
    });
  }

  /* ───────────── Variantlar banki (A-H) ───────────── */

  /**
   * Bankni to'liq almashtiradi, lekin label bo'yicha solishtiradi: saqlanib qolgan labellar
   * (va ularga bog'langan savollar) o'zgarmaydi, yo'q bo'lgan labellar o'chadi.
   */
  async setOptions(user: AuthUser, id: string, dto: SetPartOptionsDto) {
    const part = await this.getManageablePart(user, id);
    await this.assertStructureEditable(part.section.examId);

    if (!BANK_FORMATS.includes(part.format)) {
      throw new BadRequestException('Variantlar banki faqat MATCHING_BANK, MAP_LABELING yoki MIXED partlarda bo‘ladi');
    }

    const labels = dto.options.map((o) => o.label);
    if (new Set(labels).size !== labels.length) throw new BadRequestException('Label takrorlangan');
    for (const o of dto.options) {
      if (o.imageUrl && !this.isHttpUrl(o.imageUrl)) throw new BadRequestException(`${o.label}: rasm manzili noto‘g‘ri`);
    }

    await this.prisma.$transaction([
      this.prisma.partOption.deleteMany({ where: { partId: id, label: { notIn: labels } } }),
      ...dto.options.map((o) =>
        this.prisma.partOption.upsert({
          where: { partId_label: { partId: id, label: o.label } },
          create: { partId: id, label: o.label, text: o.text.trim(), imageUrl: o.imageUrl },
          update: { text: o.text.trim(), imageUrl: o.imageUrl ?? null },
        }),
      ),
    ]);

    // Banki o'zgargach javobi yo'qolgan MATCHING savollar (admin qayta belgilashi kerak)
    const orphaned = await this.prisma.question.count({
      where: { partId: id, type: QuestionType.MATCHING, correctPartOptionId: null },
    });

    const options = await this.prisma.partOption.findMany({ where: { partId: id }, orderBy: { label: 'asc' } });
    return { options, orphanedQuestions: orphaned };
  }
}
