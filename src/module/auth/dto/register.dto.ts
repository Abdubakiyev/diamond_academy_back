import { IsString, IsPhoneNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client'; // Prisma enum Role

export class RegisterDto {
  @ApiProperty({ example: 'Ali' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsPhoneNumber('UZ')
  phone: string;

  @ApiProperty({ example: 'USER', required: false, enum: Role })
  @IsOptional()
  @IsEnum(Role, { message: 'role must be USER or ADMIN' })
  role?: Role;
}
