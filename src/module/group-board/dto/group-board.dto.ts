import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_MSG = 'Oy YYYY-MM ko‘rinishida bo‘lishi kerak';
const DATE_MSG = 'Sana YYYY-MM-DD ko‘rinishida bo‘lishi kerak';

export class MonthQueryDto {
  @IsOptional()
  @Matches(MONTH_RE, { message: MONTH_MSG })
  month?: string;
}

export class FeeMonthQueryDto {
  @Matches(MONTH_RE, { message: MONTH_MSG })
  month!: string;
}

/** Shu oy uchun summa. Keyingi oylar ham (o'z summasi bo'lmasa) shuni oladi. */
export class SetFeeDto {
  @Matches(MONTH_RE, { message: MONTH_MSG })
  month!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  amount!: number;
}

/** present: true = keldi, false = kelmadi, null = yozuvni o'chirish. diamond faqat keldi bo'lsa hisoblanadi. */
export class SetAttendanceDto {
  @IsUUID()
  studentId!: string;

  @Matches(DATE_RE, { message: DATE_MSG })
  date!: string;

  @IsOptional()
  @IsBoolean()
  present?: boolean | null;

  @IsOptional()
  @IsBoolean()
  diamond?: boolean;
}

export class DayRecordDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsBoolean()
  present?: boolean | null;

  @IsOptional()
  @IsBoolean()
  diamond?: boolean;
}

export class SetDayAttendanceDto {
  @Matches(DATE_RE, { message: DATE_MSG })
  date!: string;

  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => DayRecordDto)
  records!: DayRecordDto[];
}

/** paid=true: summa berilmasa, guruhning shu oydagi summasi olinadi */
export class SetPaymentDto {
  @IsUUID()
  studentId!: string;

  @Matches(MONTH_RE, { message: MONTH_MSG })
  month!: string;

  @IsBoolean()
  paid!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  amount?: number;
}
