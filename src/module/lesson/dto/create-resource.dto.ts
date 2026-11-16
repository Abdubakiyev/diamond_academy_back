import { FileKind } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Dars materiali (PDF, rasm, audio ...). `url` yoki `storageKey` dan kamida bittasi kerak. */
export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** Tashqi havola yoki storage'ning ochiq manzili */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  url?: string;

  /** POST /storage/presign (LESSON_RESOURCE) dan olingan `key` */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

  @IsOptional()
  @IsEnum(FileKind)
  kind?: FileKind;
}
