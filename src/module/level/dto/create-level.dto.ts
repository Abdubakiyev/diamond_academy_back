import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LevelType } from '@prisma/client';

export class CreateLevelDto {
  @ApiProperty({ enum: LevelType })
  @IsEnum(LevelType)
  type: LevelType;
}
