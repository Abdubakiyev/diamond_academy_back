import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** Admin naqd / karta o'tkazma bilan to'langan to'lovni qo'lda kiritadi (darhol PAID bo'ladi) */
export class ManualPaymentDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  examId!: string;

  /** Berilmasa, imtihonning joriy narxi olinadi */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
