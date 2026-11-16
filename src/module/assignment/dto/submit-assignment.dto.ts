import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SubmissionFileDto {
  /** POST /storage/presign (SUBMISSION_FILE) dan olingan `key` */
  @ApiProperty({
    example: 'submissions/3f2b8c1e/homework-1.jpg',
    maxLength: 500,
    description: 'POST /storage/presign (SUBMISSION_FILE) dan olingan key',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey!: string;

  @ApiPropertyOptional({ example: 'homework-1.jpg', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ example: 245760, minimum: 0, maximum: 100 * 1024 * 1024, description: 'Bayt hisobida' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100 * 1024 * 1024)
  sizeBytes?: number;

  @ApiPropertyOptional({ enum: FileKind, example: FileKind.IMAGE })
  @IsOptional()
  @IsEnum(FileKind)
  kind?: FileKind;
}

export class SubmitAssignmentDto {
  @ApiPropertyOptional({ example: 'Mana mening javoblarim: 1) goes 2) plays 3) studies', maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;

  @ApiPropertyOptional({ type: [SubmissionFileDto], description: 'Eng ko\'pi bilan 10 ta fayl' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SubmissionFileDto)
  files?: SubmissionFileDto[];
}
