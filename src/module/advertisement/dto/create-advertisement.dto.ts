// src/advertisement/dto/create-advertisement.dto.ts
import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdvertisementDto {
  @ApiProperty({ description: 'Reklama sarlavhasi' })
  @IsString()
  title!: string; // ✅ ! qo'shildi

  @ApiProperty({ description: 'Reklama tavsifi' })
  @IsString()
  description!: string; // ✅ ! qo'shildi

  @ApiPropertyOptional({ description: 'Faol holati', default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // ✅ ? allaqachon bor
}