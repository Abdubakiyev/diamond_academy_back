import { QuestionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuestionOptionInputDto } from './question-input.dto';

/** Hamma maydon ixtiyoriy. `null` yuborilsa, maydon tozalanadi. options yuborilsa, to'liq almashtiriladi. */
export class UpdateQuestionDto {
  /** Tur o'zgarsa, yangi tur talablari qayta tekshiriladi (urinishlar bo'lmasa) */
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  points?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  options?: QuestionOptionInputDto[];

  @IsOptional()
  @IsString()
  @Matches(/^[A-J]$/, { message: 'correctPartOptionLabel A dan J gacha bitta harf bo‘lishi kerak' })
  correctPartOptionLabel?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  acceptedAnswers?: string[];

  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioKey?: string | null;

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
  @IsInt()
  @Min(1)
  @Max(5000)
  minWords?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  maxWords?: number | null;

  @IsOptional()
  @IsObject()
  rubric?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  explanation?: string | null;
}
