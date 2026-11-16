import { VideoSource } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLessonDto {
  @IsUUID()
  courseId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** Dars matni / konspekt */
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  description?: string;

  /** Kursdagi tartib raqami. Berilmasa, oxiriga qo'shiladi. */
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /**
   * Video manbasi:
   *  - YOUTUBE  -> videoUrl (YouTube havolasi)
   *  - EXTERNAL -> videoUrl (boshqa http/https havola)
   *  - UPLOAD   -> videoKey (POST /storage/presign dan olingan `key`)
   *  - NONE     -> video yo'q
   */
  @IsOptional()
  @IsEnum(VideoSource)
  videoSource?: VideoSource;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoKey?: string;

  /** Video davomiyligi (sekund) */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  durationSec?: number;
}
