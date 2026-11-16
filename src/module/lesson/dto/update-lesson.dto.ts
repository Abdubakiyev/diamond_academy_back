import { VideoSource } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Hamma maydon ixtiyoriy. description / durationSec ga null yuborilsa, tozalanadi. */
export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** Video maydonlaridan kamida bittasi yuborilsa, video qoidalari qayta tekshiriladi */
  @IsOptional()
  @IsEnum(VideoSource)
  videoSource?: VideoSource;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  videoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  durationSec?: number | null;
}
