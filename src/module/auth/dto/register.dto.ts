import {
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Ali' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsPhoneNumber('UZ')
  phone: string;

  @ApiProperty({ example: 'Secret123' })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt 72 baytdan keyingisini e'tiborsiz qoldiradi
  password: string;

  @ApiProperty({
    required: false,
    description: 'Faqat birinchi adminni yaratish uchun maxfiy kalit (ADMIN_SECRET)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  adminKey?: string;
}
