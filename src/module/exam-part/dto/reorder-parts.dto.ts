import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** Bo'limdagi BARCHA partlarning yangi tartibi (birinchisi 1-part bo'ladi) */
export class ReorderPartsDto {
  @IsUUID()
  sectionId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  partIds!: string[];
}
