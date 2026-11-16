import { ApiPropertyOptional } from '@nestjs/swagger';
import { EvalStatus, Skill } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListEvaluationsQueryDto {
  @ApiPropertyOptional({ enum: EvalStatus, example: EvalStatus.DONE, description: 'Baholash holati' })
  @IsOptional()
  @IsEnum(EvalStatus)
  status?: EvalStatus;

  /** WRITING yoki SPEAKING */
  @ApiPropertyOptional({ enum: Skill, example: Skill.WRITING, description: 'WRITING yoki SPEAKING' })
  @IsOptional()
  @IsEnum(Skill)
  skill?: Skill;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '7b1e2c3d-4f5a-4b6c-8d7e-9f0a1b2c3d4e',
    description: 'Imtihon ID si bo\'yicha filtr',
  })
  @IsOptional()
  @IsUUID()
  examId?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
