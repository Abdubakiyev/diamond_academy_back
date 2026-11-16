import { FileKind } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Savolga rasm / audio biriktirish (Speaking rasm kartalari, Writing grafigi). `storageKey` yoki `url` kerak. */
export class CreateMediaDto {
  @IsOptional()
  @IsEnum(FileKind)
  kind?: FileKind;

  /** POST /storage/presign (EXAM_IMAGE yoki EXAM_AUDIO) dan olingan `key` */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

  /** Tashqi havola (http / https) */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  order?: number;
}
