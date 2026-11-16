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

export class QuestionOptionInputDto {
  /** A-F. Berilmasa, tartib bo'yicha A, B, C ... beriladi */
  @IsOptional()
  @IsString()
  @Matches(/^[A-F]$/, { message: 'label A dan F gacha bitta harf bo‘lishi kerak' })
  label?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

/**
 * Bitta savol. Tur bo'yicha talablar:
 *  - MULTIPLE_CHOICE : options (2-6 ta, aynan bittasi isCorrect)
 *  - TRUE_FALSE_NG   : acceptedAnswers = ["TRUE"] | ["FALSE"] | ["NOT_GIVEN"]
 *  - SHORT_ANSWER    : acceptedAnswers (kamida 1 ta to'g'ri javob)
 *  - MATCHING        : correctPartOptionLabel (partning variantlar bankidagi harf, masalan "C")
 *  - WRITING_PROMPT  : text (topshiriq), ixtiyoriy minWords / maxWords / rubric
 *  - SPEAKING_PROMPT : text (savol), ixtiyoriy prepTimeSec / answerTimeSec / rubric
 */
export class QuestionInputDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  /** Savol matni. Gap fill: "The cat sat on the ____" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text!: string;

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
  correctPartOptionLabel?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  acceptedAnswers?: string[];

  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean;

  /** Savolga alohida audio (EXAM_AUDIO presign `key`) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  prepTimeSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  answerTimeSec?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  minWords?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  maxWords?: number;

  /** AI uchun mezonlar, masalan {"criteria":["task","coherence","lexis","grammar"]} */
  @IsOptional()
  @IsObject()
  rubric?: Record<string, unknown>;

  /** Qo'shimcha ma'lumot, masalan {"taskNo":"1.1","kind":"informal_letter"} */
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  explanation?: string;
}
