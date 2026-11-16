import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  // Oyni doim oyning 1-sanasiga (UTC yarim tun) keltiradi.
  // Frontend "2026-11" yoki "2026-11-01" yuborsin (toISOString() ishlatmang).
  private normalizeMonth(input: string | Date): Date {
    if (typeof input === 'string') {
      const m = input.match(/^(\d{4})-(\d{2})/);
      if (m) {
        const year = +m[1];
        const monthIdx = +m[2] - 1;
        if (monthIdx < 0 || monthIdx > 11) throw new BadRequestException('Oy noto‘g‘ri');
        return new Date(Date.UTC(year, monthIdx, 1));
      }
    }
    const d = new Date(input);
    if (isNaN(d.getTime())) throw new BadRequestException('Oy noto‘g‘ri');
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private parseDate(input: string | Date, field: string): Date {
    const d = new Date(input);
    if (isNaN(d.getTime())) throw new BadRequestException(`${field} noto‘g‘ri`);
    return d;
  }

  // Oy uchun amaldagi guruh summasi: shu oy yoki undan oldingi eng oxirgi yozuv
  private async effectiveFee(groupId: string, month: Date): Promise<number | null> {
    const fee = await this.prisma.groupFee.findFirst({
      where: { groupId, month: { lte: month } },
      orderBy: { month: 'desc' },
    });
    return fee ? Number(fee.amount) : null;
  }

  // Guruh summasini saqlaydi (shu oydan boshlab amal qiladi)
  async setGroupFee(groupId: string, monthInput: string, amount: number) {
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new BadRequestException('Summa noto‘g‘ri');
    }
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const month = this.normalizeMonth(monthInput);
    const fee = await this.prisma.groupFee.upsert({
      where: { groupId_month: { groupId, month } },
      create: { groupId, month, amount },
      update: { amount },
    });
    return { groupId, month: fee.month, amount: Number(fee.amount) };
  }

  // Barcha to'lovlar
  async findAll(filter?: {
    status?: PaymentStatus;
    month?: string;
    studentId?: string;
    groupId?: string;
  }) {
    const where: any = {};

    if (filter?.status) where.status = filter.status;
    if (filter?.studentId) where.studentId = filter.studentId;
    if (filter?.groupId) where.groupId = filter.groupId;
    if (filter?.month) where.month = this.normalizeMonth(filter.month);

    return this.prisma.payment.findMany({
      where,
      include: { student: true, group: true },
      orderBy: [{ month: 'desc' }, { student: { name: 'asc' } }],
    });
  }

  // To'lov qo'shish (faqat yangi qator; mavjud bo'lsa 409)
  async create(data: {
    studentId: string;
    groupId: string;
    amount: number;
    status: PaymentStatus;
    month: string;
    paidAt?: string;
    extra?: any;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
    });
    if (!student) throw new NotFoundException('Talaba topilmadi');
    if (student.groupId !== data.groupId) {
      throw new ConflictException('Talaba bu guruhda emas');
    }

    const month = this.normalizeMonth(data.month);

    const existing = await this.prisma.payment.findUnique({
      where: {
        studentId_groupId_month: {
          studentId: data.studentId,
          groupId: data.groupId,
          month,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Bu oy uchun to‘lov allaqachon mavjud. Yangilash uchun PUT /payment/student dan foydalaning',
      );
    }

    return this.prisma.payment.create({
      data: {
        studentId: data.studentId,
        groupId: data.groupId,
        amount: data.amount,
        status: data.status,
        month,
        paidAt: data.paidAt
          ? this.parseDate(data.paidAt, 'paidAt')
          : data.status === PaymentStatus.PAID
            ? new Date()
            : null,
        extra: data.extra,
      },
      include: { student: true, group: true },
    });
  }

  // Bitta student uchun: qator bo'lsa yangilaydi, bo'lmasa yaratadi
  async setStudentPayment(data: {
    studentId: string;
    groupId: string;
    month: string;
    amount: number;
    status?: PaymentStatus;
    paidAt?: string;
    extra?: any;
  }) {
    if (
      data.amount === undefined ||
      data.amount === null ||
      isNaN(Number(data.amount)) ||
      Number(data.amount) < 0
    ) {
      throw new BadRequestException('Summa noto‘g‘ri');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
    });
    if (!student) throw new NotFoundException('Talaba topilmadi');
    if (student.groupId !== data.groupId) {
      throw new ConflictException('Talaba bu guruhda emas');
    }

    const month = this.normalizeMonth(data.month);
    const status = data.status ?? PaymentStatus.PAID;
    const paidAt =
      status === PaymentStatus.PAID
        ? data.paidAt
          ? this.parseDate(data.paidAt, 'paidAt')
          : new Date()
        : null;

    return this.prisma.payment.upsert({
      where: {
        studentId_groupId_month: {
          studentId: data.studentId,
          groupId: data.groupId,
          month,
        },
      },
      create: {
        studentId: data.studentId,
        groupId: data.groupId,
        amount: data.amount,
        status,
        month,
        paidAt,
        extra: data.extra,
      },
      update: {
        amount: data.amount,
        status,
        paidAt,
        ...(data.extra !== undefined && { extra: data.extra }),
      },
      include: { student: true, group: true },
    });
  }

  // To'lovni id bo'yicha yangilash
  async update(
    id: string,
    data: {
      amount?: number;
      status?: PaymentStatus;
      paidAt?: string;
      extra?: any;
    },
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('To‘lov topilmadi');

    const updateData: any = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.extra !== undefined) updateData.extra = data.extra;

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === PaymentStatus.PAID) {
        updateData.paidAt = data.paidAt
          ? this.parseDate(data.paidAt, 'paidAt')
          : (payment.paidAt ?? new Date());
      } else if (data.paidAt === undefined) {
        // PAID dan boshqa holatga qaytarilsa, to'langan sana tozalanadi
        updateData.paidAt = null;
      }
    }
    if (data.paidAt !== undefined && data.status === undefined) {
      updateData.paidAt = this.parseDate(data.paidAt, 'paidAt');
    }

    return this.prisma.payment.update({
      where: { id },
      data: updateData,
      include: { student: true, group: true },
    });
  }

  // Guruh bo'yicha to'lovlar
  async findByGroup(groupId: string, month?: string, status?: PaymentStatus) {
    const where: any = { groupId };
    if (month) where.month = this.normalizeMonth(month);
    if (status) where.status = status;

    return this.prisma.payment.findMany({
      where,
      include: { student: true, group: true },
      orderBy: [{ month: 'desc' }, { student: { name: 'asc' } }],
    });
  }

  // Guruh sahifasi uchun: tanlangan oyda har bir faol student va uning to'lovi
  // (to'lovi yo'q bo'lsa payment = null) + guruhning amaldagi summasi (fee)
  async findGroupMonth(groupId: string, monthInput: string) {
    const month = this.normalizeMonth(monthInput);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        students: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: { payments: { where: { groupId, month } } },
        },
      },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    return {
      groupId: group.id,
      month,
      fee: await this.effectiveFee(groupId, month), // yo'q bo'lsa null
      students: group.students.map(({ payments, ...student }) => ({
        ...student,
        payment: payments[0] ?? null,
      })),
    };
  }

  // Talaba to'lovlari
  async findByStudent(studentId: string, limit = 12) {
    return this.prisma.payment.findMany({
      where: { studentId },
      include: { group: true },
      orderBy: { month: 'desc' },
      take: limit,
    });
  }

  // To'lov statistikasi
  async getGroupStats(groupId: string, startMonth?: string, endMonth?: string) {
    const where: any = { groupId };

    if (startMonth || endMonth) {
      where.month = {};
      if (startMonth) where.month.gte = this.normalizeMonth(startMonth);
      if (endMonth) where.month.lte = this.normalizeMonth(endMonth);
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: { student: true },
    });

    const stats = {
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      totalPayments: payments.length,
      paidCount: 0,
      pendingCount: 0,
      overdueCount: 0,
    };

    payments.forEach((payment) => {
      const amount = parseFloat(payment.amount.toString());
      stats.totalAmount += amount;

      switch (payment.status) {
        case PaymentStatus.PAID:
          stats.paidAmount += amount;
          stats.paidCount++;
          break;
        case PaymentStatus.PENDING:
        case PaymentStatus.PARTIAL: // Partial pending ga qo'shiladi
          stats.pendingAmount += amount;
          stats.pendingCount++;
          break;
        case PaymentStatus.OVERDUE:
          stats.overdueAmount += amount;
          stats.overdueCount++;
          break;
      }
    });

    return stats;
  }

  // Oy boshida: guruhdagi barcha faol studentlarga PENDING qator yaratadi.
  // Mavjud qatorlarga tegmaydi (to'langanlar o'zgarmaydi).
  async createMonthlyPayments(groupId: string, monthInput: string, amount: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { students: { where: { isActive: true } } },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const month = this.normalizeMonth(monthInput);

    return this.prisma.$transaction(
      group.students.map((student) =>
        this.prisma.payment.upsert({
          where: {
            studentId_groupId_month: {
              studentId: student.id,
              groupId,
              month,
            },
          },
          create: {
            studentId: student.id,
            groupId,
            amount,
            status: PaymentStatus.PENDING,
            month,
          },
          update: {},
          include: { student: true },
        }),
      ),
    );
  }
}
