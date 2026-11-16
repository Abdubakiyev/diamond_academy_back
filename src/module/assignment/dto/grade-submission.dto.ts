import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class GradeSubmissionDto {
  /** 0 dan assignment.maxScore gacha. Qaytarilganda (returnForRevision) shart emas. */
  @ApiPropertyOptional({
    example: 85,
    minimum: 0,
    description: '0 dan vazifaning maxScore gacha. returnForRevision=true bo\'lsa shart emas',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  score?: number;

  @ApiPropertyOptional({ example: 'Yaxshi ish! 4-mashqdagi xatolarni to\'g\'rilang.', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;

  /** true bo'lsa: baho qo'yilmaydi, ish qayta ishlash uchun qaytariladi (feedback shart) */
  @ApiPropertyOptional({
    example: false,
    description: 'true bo\'lsa: baho qo\'yilmaydi, ish qayta ishlashga qaytariladi (feedback shart)',
  })
  @IsOptional()
  @IsBoolean()
  returnForRevision?: boolean;
}
