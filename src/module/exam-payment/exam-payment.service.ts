import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ExamPaymentStatus, PaymentProvider, Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ExamAccessService } from './exam-access.service';
import { CheckoutDto } from './dto/checkout.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { ManualPaymentDto } from './dto/manual-payment.dto';
import { buildPaymentUrl } from './payment-url.util';

const PENDING_REUSE_MS = 30 * 60 * 1000;

const paymentSelect = {
  id: true,
  examId: true,
  userId: true,
  amount: true,
  currency: true,
  status: true,
  provider: true,
  providerTxnId: true,
  paidAt: true,
  refundedAt: true,
  createdAt: true,
  exam: { select: { id: true, title: true } },
  attempt: { select: { id: true } },
} satisfies Prisma.ExamPaymentSelect;

type PaymentRow = Prisma.ExamPaymentGetPayload<{ select: typeof paymentSelect }>;

@Injectable()
export class ExamPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ExamAccessService,
  ) {}

  private present(p: PaymentRow) {
    const { attempt, amount, ...rest } = p;
    return { ...rest, amount: Number(amount), used: !!attempt, attemptId: attempt?.id ?? null };
  }

  private mergeMeta(old: Prisma.JsonValue | null, extra: Record<string, unknown>): Prisma.InputJsonValue {
    const base = old && typeof old === 'object' && !Array.isArray(old) ? (old as Record<string, unknown>) : {};
    return { ...base, ...extra } as Prisma.InputJsonValue;
  }

  /* ───────────── Foydalanuvchi ───────────── */

  /** To'lov boshlash: PENDING to'lov yaratadi va to'lov sahifasi havolasini qaytaradi */
  async checkout(user: AuthUser, dto: CheckoutDto) {
    const info = await this.access.getAccessInfo(user, dto.examId);
    if (!info.requiresPayment) throw new BadRequestException('Bu test siz uchun bepul, to‘lov shart emas');
    if (info.canStart) {
      throw new ConflictException('Sizda to‘langan va ishlatilmagan to‘lov bor. Testni boshlashingiz mumkin');
    }

    const exam = await this.prisma.exam.findUniqueOrThrow({ where: { id: dto.examId }, select: { price: true } });

    // Yaqinda ochilgan, tugallanmagan to'lovni qayta ishlatamiz (har bosishda yangi yozuv yaratmaslik uchun)
    const existing = await this.prisma.examPayment.findFirst({
      where: {
        userId: user.id,
        examId: dto.examId,
        provider: dto.provider,
        status: ExamPaymentStatus.PENDING,
        createdAt: { gte: new Date(Date.now() - PENDING_REUSE_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: paymentSelect,
    });

    const payment =
      existing ??
      (await this.prisma.examPayment.create({
        data: {
          userId: user.id,
          examId: dto.examId,
          amount: exam.price,
          currency: 'UZS',
          provider: dto.provider,
          status: ExamPaymentStatus.PENDING,
        },
        select: paymentSelect,
      }));

    const { url, note } = buildPaymentUrl(dto.provider, { id: payment.id, amount: Number(payment.amount) });
    return { payment: this.present(payment), paymentUrl: url, note: note ?? null };
  }

  async listMine(user: AuthUser) {
    const items = await this.prisma.examPayment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: paymentSelect,
    });
    return items.map((p) => this.present(p));
  }

  /* ───────────── Admin ───────────── */

  async list(query: ListPaymentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ExamPaymentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.examId ? { examId: query.examId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.examPayment.count({ where }),
      this.prisma.examPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { ...paymentSelect, user: { select: { id: true, name: true, phone: true } } },
      }),
    ]);

    return {
      items: items.map((p) => ({ ...this.present(p), user: p.user })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * To'lovni PAID qiladi (idempotent). Admin tasdiqlashi ham, kelajakda Click / Payme webhook ham shuni chaqiradi.
   */
  async markPaid(
    paymentId: string,
    opts: { providerTxnId?: string; raw?: Record<string, unknown>; confirmedById?: string; note?: string } = {},
  ) {
    const payment = await this.prisma.examPayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('To‘lov topilmadi');
    if (payment.status === ExamPaymentStatus.PAID) return this.getOne(paymentId);
    if (payment.status !== ExamPaymentStatus.PENDING) {
      throw new ConflictException(`${payment.status} holatidagi to‘lovni tasdiqlab bo‘lmaydi`);
    }

    try {
      const res = await this.prisma.examPayment.updateMany({
        where: { id: paymentId, status: ExamPaymentStatus.PENDING },
        data: {
          status: ExamPaymentStatus.PAID,
          paidAt: new Date(),
          providerTxnId: opts.providerTxnId ?? payment.providerTxnId,
          meta: this.mergeMeta(payment.meta, {
            ...(opts.confirmedById ? { confirmedById: opts.confirmedById } : {}),
            ...(opts.note ? { note: opts.note } : {}),
            ...(opts.raw ? { provider: opts.raw } : {}),
          }),
        },
      });
      if (res.count === 0) return this.getOne(paymentId); // boshqa so'rov oldin tasdiqlab ulgurgan
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Bu tranzaksiya ID allaqachon boshqa to‘lovda ishlatilgan');
      }
      throw e;
    }
    return this.getOne(paymentId);
  }

  private async getOne(id: string) {
    const p = await this.prisma.examPayment.findUniqueOrThrow({ where: { id }, select: paymentSelect });
    return this.present(p);
  }

  confirm(admin: AuthUser, id: string, note?: string) {
    return this.markPaid(id, { confirmedById: admin.id, note });
  }

  async cancel(admin: AuthUser, id: string, note?: string) {
    const payment = await this.prisma.examPayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('To‘lov topilmadi');
    if (payment.status !== ExamPaymentStatus.PENDING) {
      throw new ConflictException('Faqat kutilayotgan (PENDING) to‘lovni bekor qilish mumkin');
    }
    await this.prisma.examPayment.update({
      where: { id },
      data: {
        status: ExamPaymentStatus.CANCELLED,
        meta: this.mergeMeta(payment.meta, { cancelledById: admin.id, ...(note ? { note } : {}) }),
      },
    });
    return this.getOne(id);
  }

  /** Faqat ishlatilmagan (urinish ochilmagan) to'lovni qaytarish mumkin. Pul qaytarish provayderda qo'lda bajariladi. */
  async refund(admin: AuthUser, id: string, note?: string) {
    const payment = await this.prisma.examPayment.findUnique({ where: { id }, include: { attempt: { select: { id: true } } } });
    if (!payment) throw new NotFoundException('To‘lov topilmadi');
    if (payment.status !== ExamPaymentStatus.PAID) throw new ConflictException('Faqat to‘langan (PAID) to‘lovni qaytarish mumkin');
    if (payment.attempt) {
      throw new ConflictException('Bu to‘lov bilan test boshlangan, qaytarib bo‘lmaydi');
    }
    await this.prisma.examPayment.update({
      where: { id },
      data: {
        status: ExamPaymentStatus.REFUNDED,
        refundedAt: new Date(),
        meta: this.mergeMeta(payment.meta, { refundedById: admin.id, ...(note ? { refundNote: note } : {}) }),
      },
    });
    return this.getOne(id);
  }

  /** Naqd / karta o'tkazma: admin to'lovni qo'lda kiritadi (darhol PAID) */
  async createManual(admin: AuthUser, dto: ManualPaymentDto) {
    const [user, exam] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } }),
      this.prisma.exam.findUnique({ where: { id: dto.examId }, select: { id: true, price: true } }),
    ]);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (!exam) throw new NotFoundException('Imtihon topilmadi');

    const created = await this.prisma.examPayment.create({
      data: {
        userId: dto.userId,
        examId: dto.examId,
        amount: dto.amount ?? exam.price,
        currency: 'UZS',
        provider: PaymentProvider.MANUAL,
        status: ExamPaymentStatus.PAID,
        paidAt: new Date(),
        meta: { manual: true, confirmedById: admin.id, ...(dto.note ? { note: dto.note } : {}) },
      },
      select: paymentSelect,
    });
    return this.present(created);
  }
}
