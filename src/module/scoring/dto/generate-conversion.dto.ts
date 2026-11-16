import { Skill } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Chiziqli (raw / maxRaw * 75) jadval yaratadi. Rasmiy Rasch jadvali kelgach, PUT bilan almashtiriladi. */
export class GenerateConversionDto {
  @IsOptional()
  @IsUUID()
  examId?: string;

  @IsEnum(Skill)
  skill!: Skill;

  /** Maksimal to'g'ri javoblar soni. examId berilsa va bo'sh qoldirilsa, bo'limdagi savollar balidan olinadi. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxRaw?: number;
}
