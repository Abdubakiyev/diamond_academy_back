import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ format: 'uuid', example: '2c9d1e7a-3b4f-4c5d-8e6f-7a8b9c0d1e2f', description: 'Mavjud dars ID si' })
  @IsUUID()
  lessonId!: string;

  @ApiProperty({ example: 'Present Simple mashqlari', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** Vazifa sharti */
  @ApiProperty({
    example: 'Darslikdagi 12-betdagi 1-5 mashqlarni bajaring va rasmga olib yuklang.',
    maxLength: 20000,
    description: 'Vazifa sharti',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  instructions!: string;

  /** Maksimal ball (standart 100) */
  @ApiPropertyOptional({ example: 100, minimum: 1, maximum: 1000, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number;

  /** Topshirish muddati (ISO sana) */
  @ApiPropertyOptional({ example: '2026-12-01T18:00:00Z', description: 'Topshirish muddati (ISO sana)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'O\'quvchi matn yozib topshira oladimi' })
  @IsOptional()
  @IsBoolean()
  allowText?: boolean;

  @ApiPropertyOptional({ example: true, default: true, description: 'O\'quvchi rasm / fayl yuklay oladimi' })
  @IsOptional()
  @IsBoolean()
  allowFiles?: boolean;
}
