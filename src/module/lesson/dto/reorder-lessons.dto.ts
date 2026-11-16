import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** Kursdagi BARCHA darslarning yangi tartibi (birinchisi 1-dars bo'ladi) */
export class ReorderLessonsDto {
  @IsUUID()
  courseId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  lessonIds!: string[];
}
