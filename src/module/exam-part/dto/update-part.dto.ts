import { PartFormat } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Hamma maydon ixtiyoriy. `null` yuborilsa, maydon tozalanadi (audioKey / imageKey null bo'lsa fayl ham o'chadi). */
export class UpdatePartDto {
  /** Format faqat partda savol yo'q paytda o'zgaradi */
  @IsOptional()
  @IsEnum(PartFormat)
  format?: PartFormat;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  audioPlayLimit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  passageText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(36000)
  timeLimitSec?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  prepTimeSec?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  answerTimeSec?: number | null;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown> | null;
}
