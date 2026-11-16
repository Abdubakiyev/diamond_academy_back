import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ example: 'English A1 - Beginner', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Noldan boshlovchilar uchun umumiy ingliz tili kursi.', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/covers/a1.jpg', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverUrl?: string;

  @ApiPropertyOptional({ format: 'uuid', example: '4b3a2c1d-0e9f-4a8b-9c7d-6e5f4a3b2c1d', description: 'Mavjud Level ID si' })
  @IsOptional()
  @IsUUID()
  levelId?: string;

  @ApiPropertyOptional({ example: false, default: false, description: 'false = qoralama, o\'quvchilarga ko\'rinmaydi' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
