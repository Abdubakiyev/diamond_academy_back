import { PaymentProvider } from '@prisma/client';
import { IsIn, IsUUID } from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  examId!: string;

  /** MANUAL (naqd) faqat admin tomonidan kiritiladi */
  @IsIn([PaymentProvider.CLICK, PaymentProvider.PAYME, PaymentProvider.UZUM])
  provider!: PaymentProvider;
}
