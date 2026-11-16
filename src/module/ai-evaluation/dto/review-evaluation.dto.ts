import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** O'qituvchi / admin AI bahosini o'zgartiradi */
export class ReviewEvaluationDto {
  @ApiProperty({
    example: 62.5,
    minimum: 0,
    maximum: 75,
    description: '0-75. Bu ball AI bahosining o\'rniga hisobga olinadi (1 xonagacha kasr)',
  })
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(75)
  finalScore!: number;

  @ApiPropertyOptional({
    example: 'Grammatika yaxshi, lug\'at boyroq bo\'lishi mumkin.',
    maxLength: 5000,
    description: 'Berilsa, talabaga ko\'rinadigan umumiy izoh shu bilan almashtiriladi',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;
}
