import { PartFormat } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePartDto {
  @IsUUID()
  sectionId!: string;

  @IsEnum(PartFormat)
  format!: PartFormat;

  /** Masalan "Part 1" */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string;

  /** Listening: POST /storage/presign (EXAM_AUDIO) dan olingan `key` */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioKey?: string;

  /** Audio necha marta eshittiriladi (standart 2) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  audioPlayLimit?: number;

  /** Reading matni (gap fill: bo'sh joylar [1], [2] ... bilan belgilanadi) */
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  passageText?: string;

  /** Xarita / grafik / rasm: POST /storage/presign (EXAM_IMAGE) dan olingan `key` */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageKey?: string;

  /** Part vaqti (sekund) */
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(36000)
  timeLimitSec?: number;

  /** Speaking: tayyorlanish vaqti (sekund) */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  prepTimeSec?: number;

  /** Speaking: javob berish vaqti (sekund) */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  answerTimeSec?: number;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
