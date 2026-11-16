import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ExamAccessType, ExamPaymentStatus, Role } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

export type AccessGrant = { accessType: ExamAccessType; paymentId: string | null };

/**
 * Testga kirish qoidalari:
 *   1) ADMIN / TEACHER                    -> FREE_STAFF
 *   2) User.isCenterStudent = true        -> FREE_STUDENT  (admin belgilaydi)
 *   3) Exam.price = 0                     -> FREE_EXAM
 *   4) Boshqalar                          -> PAID (to'langan va hali ishlatilmagan ExamPayment kerak)
 * Bitta to'lov = bitta urinish (ExamAttempt.paymentId unique).
 */
@Injectable()
export class ExamAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** To'lovsiz kirish turi. null bo'lsa, to'lov kerak. */
  freeAccessType(role: Role, isCenterStudent: boolean, price: number): ExamAccessType | null {
    if (role === Role.ADMIN || role === Role.TEACHER) return ExamAccessType.FREE_STAFF;
    if (isCenterStudent) return ExamAccessType.FREE_STUDENT;
    if (price <= 0) return ExamAccessType.FREE_EXAM;
    return null;
  }

  private findUnusedPayment(userId: string, examId: string) {
    return this.prisma.examPayment.findFirst({
      where: { userId, examId, status: ExamPaymentStatus.PAID, attempt: { is: null } },
      orderBy: { paidAt: 'asc' },
      select: { id: true },
    });
  }

  /** Foydalanuvchi shu testga qanday kira olishi haqida ma'lumot (frontend "To'lash" yoki "Boshlash" tugmasi uchun) */
  async getAccessInfo(user: AuthUser, examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, price: true, isPublished: true, archivedAt: true },
    });
    const staff = user.role === Role.ADMIN || user.role === Role.TEACHER;
    if (!exam || (!staff && (!exam.isPublished || exam.archivedAt))) throw new NotFoundException('Imtihon topilmadi');

    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id }, select: { isCenterStudent: true } });
    const price = Number(exam.price);
    const accessType = this.freeAccessType(user.role, !!dbUser?.isCenterStudent, price);

    if (accessType) {
      return { examId, title: exam.title, price, accessType, requiresPayment: false, canStart: true, unusedPaymentId: null, pendingPaymentId: null };
    }

    const [unused, pending] = await Promise.all([
      this.findUnusedPayment(user.id, examId),
      this.prisma.examPayment.findFirst({
        where: { userId: user.id, examId, status: ExamPaymentStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }),
    ]);

    return {
      examId,
      title: exam.title,
      price,
      accessType: ExamAccessType.PAID,
      requiresPayment: true,
      canStart: !!unused,
      unusedPaymentId: unused?.id ?? null,
      pendingPaymentId: pending?.id ?? null,
    };
  }

  /**
   * Urinish ochishdan oldin (10-bo'lim) chaqiriladi: kirish turini va (kerak bo'lsa) ishlatiladigan to'lovni aniqlaydi.
   * To'lov kerak, lekin yo'q bo'lsa — 402 Payment Required.
   * Natijadagi paymentId ExamAttempt.paymentId ga yoziladi (unique, shuning uchun ikki marta ishlatib bo'lmaydi).
   */
  async resolveForAttempt(userId: string, role: Role, examId: string): Promise<AccessGrant> {
    const [exam, dbUser] = await Promise.all([
      this.prisma.exam.findUnique({ where: { id: examId }, select: { price: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { isCenterStudent: true } }),
    ]);
    if (!exam) throw new NotFoundException('Imtihon topilmadi');

    const price = Number(exam.price);
    const free = this.freeAccessType(role, !!dbUser?.isCenterStudent, price);
    if (free) return { accessType: free, paymentId: null };

    const unused = await this.findUnusedPayment(userId, examId);
    if (!unused) {
      throw new HttpException(
        { statusCode: HttpStatus.PAYMENT_REQUIRED, message: 'Bu testni boshlash uchun to‘lov qilish kerak', examId, price },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return { accessType: ExamAccessType.PAID, paymentId: unused.id };
  }
}
