// attendance.dto.ts
import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAttendanceDto {
  @ApiProperty({ description: 'Talaba ismi (qo\'lda kiritiladi)', example: 'Ali Valiyev' })
  @IsString()
  @IsNotEmpty()
  student!: string;

  @ApiProperty({ description: 'Guruh nomi (qo\'lda kiritiladi)', example: '17:30 - A1' })
  @IsString()
  @IsNotEmpty()
  group!: string;

  @ApiProperty({
    description: 'Dars kuni',
    type: String,
    format: 'date',
    example: '2024-01-15'
  })
  @IsDateString()
  date!: Date;

  @ApiProperty({
    description: 'Talaba darsga keldi yoki yo\'q',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  present?: boolean;

  @ApiProperty({
    description: 'Qo\'shimcha ma\'lumotlar JSON formatida',
    required: false,
    example: { marks: 5, note: 'Faol ishtirok etdi', homework: true },
  })
  @IsOptional()
  extra?: Record<string, any>;
}

export class UpdateAttendanceDto extends PartialType(CreateAttendanceDto) {}

export class AttendanceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Ali Valiyev' })
  student!: string;

  @ApiProperty({ example: '17:30 - A1' })
  group!: string;

  @ApiProperty()
  date!: Date;

  @ApiProperty()
  present!: boolean;

  @ApiProperty({ required: false })
  extra?: Record<string, any>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}