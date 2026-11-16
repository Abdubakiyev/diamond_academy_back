import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Bitta savolga javob. Tur bo'yicha:
 *  MULTIPLE_CHOICE : selectedOptionId
 *  MATCHING        : selectedPartOptionId
 *  TRUE_FALSE_NG   : textAnswer = TRUE | FALSE | NOT_GIVEN
 *  SHORT_ANSWER    : textAnswer
 *  WRITING_PROMPT  : textAnswer (insho matni)
 *  SPEAKING_PROMPT : audioKey (POST /storage/presign, SPEAKING_AUDIO) + durationSec
 * Hamma maydon bo'sh (null) yuborilsa, javob o'chiriladi.
 */
export class AnswerInputDto {
  @IsUUID()
  questionId!: string;

  @IsOptional()
  @IsUUID()
  selectedOptionId?: string | null;

  @IsOptional()
  @IsUUID()
  selectedPartOptionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  textAnswer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  durationSec?: number | null;
}

export class SaveAnswersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers!: AnswerInputDto[];
}
