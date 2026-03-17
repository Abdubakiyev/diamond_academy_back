// src/advertisement/dto/update-advertisement.dto.ts
import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdvertisementDto {
  @ApiPropertyOptional({ description: 'Reklama sarlavhasi' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Reklama tavsifi' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Faol holati' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}