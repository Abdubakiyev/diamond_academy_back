import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { QuestionInputDto } from './question-input.dto';

/** Bitta savol: partId + savol maydonlari */
export class CreateQuestionDto extends QuestionInputDto {
  @IsUUID()
  partId!: string;
}

/** Ko'p savolni birdan qo'shish (partning oxiriga, berilgan tartibda) */
export class CreateQuestionsBulkDto {
  @IsUUID()
  partId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => QuestionInputDto)
  questions!: QuestionInputDto[];
}
