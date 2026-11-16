import { Skill } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ConversionQueryDto {
  /** Berilmasa — umumiy (default) jadval */
  @IsOptional()
  @IsUUID()
  examId?: string;

  @IsEnum(Skill)
  skill!: Skill;
}
