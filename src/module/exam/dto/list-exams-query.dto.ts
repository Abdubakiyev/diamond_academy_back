import { ExamType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined;

export class ListExamsQueryDto {
  @IsOptional()
  @IsEnum(ExamType)
  type?: ExamType;

  @IsOptional()
  @IsUUID()
  levelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Faqat admin / o'qituvchi uchun: e'lon qilinganlar (true) yoki qoralamalar (false) */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  published?: boolean;

  /** Faqat admin / o'qituvchi uchun: arxivdagilar (true). Standart: arxivsizlar */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
