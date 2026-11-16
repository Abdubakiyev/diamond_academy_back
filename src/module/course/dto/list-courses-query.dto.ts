import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ListCoursesQueryDto {
  @ApiPropertyOptional({ format: 'uuid', example: '4b3a2c1d-0e9f-4a8b-9c7d-6e5f4a3b2c1d', description: 'Daraja bo\'yicha filtr' })
  @IsOptional()
  @IsUUID()
  levelId?: string;

  @ApiPropertyOptional({ example: 'English', maxLength: 100, description: 'Sarlavha bo\'yicha qidiruv' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Faqat admin / o'qituvchi uchun: 'true' | 'false' */
  @ApiPropertyOptional({ enum: ['true', 'false'], example: 'true', description: 'Faqat admin / o\'qituvchi uchun' })
  @IsOptional()
  @IsIn(['true', 'false'])
  published?: 'true' | 'false';
}
