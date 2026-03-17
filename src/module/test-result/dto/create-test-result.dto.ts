import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ArrayNotEmpty, IsIn } from 'class-validator';

export class AnswerDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @IsIn(['A','B','C','D'])
  answer: string;

  @ApiProperty({ example: 'test-uuid' })
  @IsString()
  testId: string;
}

export class CreateTestResultDto {
  @ApiProperty({ example: 'level-uuid' })
  @IsString()
  levelId: string;

  @ApiProperty({ type: [AnswerDto] })
  @IsArray()
  @ArrayNotEmpty()
  answers: AnswerDto[];
}
