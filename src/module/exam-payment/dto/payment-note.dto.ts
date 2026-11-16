import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PaymentNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
