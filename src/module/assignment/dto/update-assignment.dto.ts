import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Hamma maydon ixtiyoriy. dueDate ga null yuborilsa, muddat olib tashlanadi. */
export class UpdateAssignmentDto {
  @ApiPropertyOptional({ example: 'Present Simple: qayta ko\'rib chiqilgan mashqlar', maxLength: 200 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: '12-betdagi 1-8 mashqlarni bajaring.', maxLength: 20000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  instructions?: string;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-12-10T18:00:00Z',
    description: 'Yangi muddat. null yuborilsa, muddat olib tashlanadi',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowText?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowFiles?: boolean;
}
