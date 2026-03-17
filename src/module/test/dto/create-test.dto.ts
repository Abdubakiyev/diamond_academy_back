import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateTestDto {
  @ApiProperty({ example: 'What is 2 + 2?' })
  @IsString()
  question: string;

  @ApiProperty({ example: '1' })
  @IsString()
  optionA: string;

  @ApiProperty({ example: '2' })
  @IsString()
  optionB: string;

  @ApiProperty({ example: '3' })
  @IsString()
  optionC: string;

  @ApiProperty({ example: '4', required: false })
  @IsOptional()
  @IsString()
  optionD?: string;

  @ApiProperty({ example: 'B', enum: ['A','B','C','D'] })
  @IsString()
  @IsIn(['A','B','C','D'])
  correct: string;

  @ApiProperty({ example: 'level-uuid' })
  @IsString()
  levelId: string;
}
