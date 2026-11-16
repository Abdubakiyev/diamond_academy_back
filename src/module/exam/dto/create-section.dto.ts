import { Skill } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Faqat CUSTOM testga bo'lim qo'shish uchun (FULL_MULTILEVEL da 4 ta bo'lim tayyor bo'ladi) */
export class CreateSectionDto {
  @IsEnum(Skill)
  skill!: Skill;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string;

  /** Bo'lim vaqti (sekund) */
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(36000)
  timeLimitSec?: number;
}
