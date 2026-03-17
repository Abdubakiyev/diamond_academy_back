import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ 
    description: 'Talaba ismi (qo\'lda kiritiladi)', 
    example: 'Ali Valiyev' 
  })
  @IsString()
  @IsNotEmpty()
  student!: string;

  @ApiProperty({ 
    description: 'Guruh nomi (qo\'lda kiritiladi)', 
    example: '17:30 - A1' 
  })
  @IsString()
  @IsNotEmpty()
  group!: string;

  @ApiProperty({
    description: 'To\'lov summasi',
    example: 500000,
    type: Number,
  })
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({
    description: 'To\'lov holati',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    required: false,
  })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiProperty({
    description: 'Qaysi oy uchun to\'lov (YYYY-MM-DD formatida)',
    type: String,
    format: 'date',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  month!: Date;

  @ApiProperty({
    description: 'To\'lov qilingan sana',
    type: String,
    format: 'date-time',
    required: false,
    example: '2024-01-15T10:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  paidAt?: Date;

  @ApiProperty({
    description: 'Qo\'shimcha ma\'lumotlar JSON formatida',
    required: false,
    example: { discount: 50000, note: 'Chegirma berildi', receipt: '123456' },
  })
  @IsOptional()
  extra?: Record<string, any>;
}

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Ali Valiyev' })
  student!: string;

  @ApiProperty({ example: '17:30 - A1' })
  group!: string;

  @ApiProperty({ example: 500000 })
  amount!: number;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty()
  month!: Date;

  @ApiProperty({ required: false })
  paidAt?: Date;

  @ApiProperty({ required: false })
  extra?: Record<string, any>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaymentStatsDto {
  @ApiProperty({ description: 'Jami to\'lovlar soni' })
  totalPayments!: number;

  @ApiProperty({ description: 'To\'langan summalar' })
  paidAmount!: number;

  @ApiProperty({ description: 'Kutilayotgan summalar' })
  pendingAmount!: number;

  @ApiProperty({ description: 'Qisman to\'langan summalar' })
  partialAmount!: number;

  @ApiProperty({ description: 'Muddati o\'tgan summalar' })
  overdueAmount!: number;

  @ApiProperty({ description: 'Jami summa' })
  totalAmount!: number;
}