import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Hamma maydon ixtiyoriy. description / coverUrl / levelId ga null yuborilsa, qiymat tozalanadi. */
export class UpdateCourseDto {
  @ApiPropertyOptional({ example: 'English A1 - yangilangan', maxLength: 200 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Yangilangan tavsif', maxLength: 5000, description: 'null = tozalash' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://cdn.example.com/covers/a1-new.jpg', maxLength: 1000, description: 'null = tozalash' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverUrl?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: '4b3a2c1d-0e9f-4a8b-9c7d-6e5f4a3b2c1d', description: 'null = tozalash' })
  @IsOptional()
  @IsUUID()
  levelId?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
