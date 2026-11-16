import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Role, Skill } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { linearScale, round1 } from '../../common/scoring';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ExamService } from '../exam/exam.service';
import { ConversionQueryDto } from './dto/conversion-query.dto';
import { GenerateConversionDto } from './dto/generate-conversion.dto';
import { SetConversionDto } from './dto/set-conversion.dto';

export type ConversionSource = 'EXAM_TABLE' | 'DEFAULT_TABLE' | 'LINEAR';

@Injectable()
export class ScoreConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExamService,
  ) {}

  /* ───────────── Yordamchilar ───────────── */

  private assertObjectiveSkill(skill: Skill) {
    if (skill !== Skill.LISTENING && skill !== Skill.READING) {
      throw new BadRequestException('Jadval faqat LISTENING va READING uchun. Writing / Speaking AI orqali 0-75 oladi');
    }
  }

  /** examId yo'q (umumiy jadval) — faqat ADMIN. examId bor — imtihon egasi yoki ADMIN. */
  private async assertCanEdit(user: AuthUser, examId?: string) {
    if (!examId) {
      if (user.role !== Role.ADMIN) throw new ForbiddenException('Umumiy jadvalni faqat admin o‘zgartira oladi');
      return;
    }
    await this.exams.getManageableExam(user, examId);
  }

  private async replaceTable(examId: string | undefined, skill: Skill, rows: { rawScore: number; scaledScore: number }[]) {
    await this.prisma.$transaction([
      this.prisma.scoreConversion.deleteMany({ where: { examId: examId ?? null, skill } }),
      this.prisma.scoreConversion.createMany({
        data: rows.map((r) => ({ examId: examId ?? null, skill, rawScore: r.rawScore, scaledScore: r.scaledScore })),
      }),
    ]);
  }

  /* ───────────── Admin: jadval boshqaruvi ───────────── */

  async list(query: ConversionQueryDto) {
    const rows = await this.prisma.scoreConversion.findMany({
      where: { examId: query.examId ?? null, skill: query.skill },
      orderBy: { rawScore: 'asc' },
      select: { rawScore: true, scaledScore: true },
    });
    return { examId: query.examId ?? null, skill: query.skill, rows };
  }

  async setTable(user: AuthUser, dto: SetConversionDto) {
    this.assertObjectiveSkill(dto.skill);
    await this.assertCanEdit(user, dto.examId);

    const rows = [...dto.rows].sort((a, b) => a.rawScore - b.rawScore);
    for (let i = 0; i < rows.length; i++) {
      if (i > 0 && rows[i].rawScore === rows[i - 1].rawScore) {
        throw new BadRequestException(`rawScore ${rows[i].rawScore} takrorlangan`);
      }
      if (i > 0 && rows[i].scaledScore < rows[i - 1].scaledScore) {
        throw new BadRequestException(
          `Ball kamaymasligi kerak: ${rows[i - 1].rawScore} -> ${rows[i - 1].scaledScore}, lekin ${rows[i].rawScore} -> ${rows[i].scaledScore}`,
        );
      }
    }

    await this.replaceTable(dto.examId, dto.skill, rows);
    return this.list({ examId: dto.examId, skill: dto.skill });
  }

  async generateLinear(user: AuthUser, dto: GenerateConversionDto) {
    this.assertObjectiveSkill(dto.skill);
    await this.assertCanEdit(user, dto.examId);

    let maxRaw = dto.maxRaw;
    if (maxRaw === undefined) {
      if (!dto.examId) throw new BadRequestException('maxRaw ni kiriting (umumiy jadval uchun u majburiy)');
      const agg = await this.prisma.question.aggregate({
        where: { part: { section: { examId: dto.examId, skill: dto.skill } } },
        _sum: { points: true },
      });
      maxRaw = Math.round(agg._sum.points ?? 0);
      if (maxRaw < 1) throw new BadRequestException('Bu bo‘limda hali savollar yo‘q, maxRaw ni qo‘lda kiriting');
    }

    const rows = Array.from({ length: maxRaw + 1 }, (_, raw) => ({
      rawScore: raw,
      scaledScore: linearScale(raw, maxRaw as number),
    }));
    await this.replaceTable(dto.examId, dto.skill, rows);
    return this.list({ examId: dto.examId, skill: dto.skill });
  }

  async remove(user: AuthUser, query: ConversionQueryDto) {
    await this.assertCanEdit(user, query.examId);
    const res = await this.prisma.scoreConversion.deleteMany({
      where: { examId: query.examId ?? null, skill: query.skill },
    });
    return { deleted: res.count };
  }

  /* ───────────── Baholash uchun ───────────── */

  /**
   * To'g'ri javoblar sonini 0-75 ballga o'tkazadi.
   * Tartib: imtihonning o'z jadvali -> umumiy jadval -> chiziqli hisob.
   * Jadvalda aniq raw bo'lmasa, undan kichik eng yaqin qator olinadi (eng kichik qatordan pastda — 0).
   */
  async convert(examId: string, skill: Skill, raw: number, maxRaw: number): Promise<{ scaled: number; source: ConversionSource }> {
    let source: ConversionSource = 'EXAM_TABLE';
    let rows = await this.prisma.scoreConversion.findMany({
      where: { examId, skill },
      orderBy: { rawScore: 'asc' },
      select: { rawScore: true, scaledScore: true },
    });

    if (rows.length === 0) {
      source = 'DEFAULT_TABLE';
      rows = await this.prisma.scoreConversion.findMany({
        where: { examId: null, skill },
        orderBy: { rawScore: 'asc' },
        select: { rawScore: true, scaledScore: true },
      });
    }

    if (rows.length === 0) return { scaled: linearScale(raw, maxRaw), source: 'LINEAR' };

    const r = Math.floor(raw + 1e-9);
    let scaled = 0;
    for (const row of rows) {
      if (row.rawScore <= r) scaled = row.scaledScore;
      else break;
    }
    return { scaled: round1(scaled), source };
  }
}
