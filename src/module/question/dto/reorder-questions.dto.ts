import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** Partdagi BARCHA savollarning yangi tartibi */
export class ReorderQuestionsDto {
  @IsUUID()
  partId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  questionIds!: string[];
}
