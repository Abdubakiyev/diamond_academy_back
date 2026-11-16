import { PaymentProvider } from '@prisma/client';

export type PaymentUrlResult = { url: string | null; note?: string };

/**
 * To'lov sahifasi havolasini yaratadi.
 *
 * .env:
 *   CLICK_SERVICE_ID, CLICK_MERCHANT_ID
 *   PAYME_MERCHANT_ID, PAYME_ACCOUNT_FIELD (standart: order_id — Payme kabinetidagi "account" maydoni nomi)
 *   PAYMENT_RETURN_URL (Click to'lovdan keyin qaytadigan sahifa)
 *
 * DIQQAT: havola formatlari ochiq hujjatlardagi odatiy ko'rinish. Ishga tushirishdan oldin
 * o'z merchant kabinetingiz hujjatlari bilan solishtiring.
 */
export function buildPaymentUrl(
  provider: PaymentProvider,
  payment: { id: string; amount: number },
): PaymentUrlResult {
  switch (provider) {
    case PaymentProvider.CLICK: {
      const serviceId = process.env.CLICK_SERVICE_ID;
      const merchantId = process.env.CLICK_MERCHANT_ID;
      if (!serviceId || !merchantId) return { url: null, note: 'Click sozlanmagan (CLICK_SERVICE_ID, CLICK_MERCHANT_ID)' };

      const params = new URLSearchParams({
        service_id: serviceId,
        merchant_id: merchantId,
        amount: String(payment.amount),
        transaction_param: payment.id,
      });
      if (process.env.PAYMENT_RETURN_URL) params.set('return_url', process.env.PAYMENT_RETURN_URL);
      return { url: `https://my.click.uz/services/pay?${params.toString()}` };
    }

    case PaymentProvider.PAYME: {
      const merchantId = process.env.PAYME_MERCHANT_ID;
      if (!merchantId) return { url: null, note: 'Payme sozlanmagan (PAYME_MERCHANT_ID)' };

      const field = process.env.PAYME_ACCOUNT_FIELD || 'order_id';
      const tiyin = Math.round(payment.amount * 100); // Payme summani tiyinda kutadi
      const raw = `m=${merchantId};ac.${field}=${payment.id};a=${tiyin}`;
      return { url: `https://checkout.paycom.uz/${Buffer.from(raw).toString('base64')}` };
    }

    default:
      return { url: null, note: `${provider} integratsiyasi hali ulanmagan` };
  }
}
