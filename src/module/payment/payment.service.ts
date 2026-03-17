import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  // Barcha to'lovlar
  async findAll(filter?: {
    status?: PaymentStatus;
    month?: Date;
    studentId?: string;
    groupId?: string;
  }) {
    const where: any = {};
  
    if (filter?.status) where.status = filter.status;
    if (filter?.studentId) where.studentId = filter.studentId;
    if (filter?.groupId) where.groupId = filter.groupId;
    if (filter?.month) where.month = new Date(filter.month);
  
    return this.prisma.payment.findMany({
      where,
      include: {
        student: true,
        group: true,
      },
      orderBy: [{ month: 'desc' }, { student: { name: 'asc' } }],
    });
  }

  // To'lov qo'shish
  async create(data: {
    studentId: string;
    groupId: string;
    amount: number;
    status: PaymentStatus;
    month: Date;
    paidAt?: Date;
    extra?: any;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
    });

    if (!student) {
      throw new NotFoundException('Talaba topilmadi');
    }

    if (student.groupId !== data.groupId) {
      throw new ConflictException('Talaba bu guruhda emas');
    }

    // Shu oy uchun to'lov mavjudmi?
    const existing = await this.prisma.payment.findUnique({
      where: {
        studentId_groupId_month: {
          studentId: data.studentId,
          groupId: data.groupId,
          month: new Date(data.month),
        },
      },
    });

    if (existing) {
      throw new ConflictException('Bu oy uchun to\'lov allaqachon mavjud');
    }

    return this.prisma.payment.create({
      data: {
        studentId: data.studentId,
        groupId: data.groupId,
        amount: data.amount,
        status: data.status,
        month: new Date(data.month),
        paidAt: data.paidAt ? new Date(data.paidAt) : data.status === PaymentStatus.PAID ? new Date() : null,
        extra: data.extra,
      },
      include: {
        student: true,
        group: true,
      },
    });
  }

  // To'lovni yangilash
  async update(
    id: string,
    data: {
      amount?: number;
      status?: PaymentStatus;
      paidAt?: Date;
      extra?: any;
    },
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });

    if (!payment) {
      throw new NotFoundException('To\'lov topilmadi');
    }

    // Agar status PAID ga o'zgartirilsa va paidAt yo'q bo'lsa
    if (data.status === PaymentStatus.PAID && !payment.paidAt && !data.paidAt) {
      data.paidAt = new Date();
    }

    return this.prisma.payment.update({
      where: { id },
      data,
      include: {
        student: true,
        group: true,
      },
    });
  }

  // Guruh bo'yicha to'lovlar
  async findByGroup(groupId: string, month?: Date, status?: PaymentStatus) {
    const where: any = { groupId };

    if (month) {
      where.month = new Date(month);
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.payment.findMany({
      where,
      include: {
        student: true,
        group: true,
      },
      orderBy: [{ month: 'desc' }, { student: { name: 'asc' } }],
    });
  }

  // Talaba to'lovlari
  async findByStudent(studentId: string, limit = 12) {
    return this.prisma.payment.findMany({
      where: { studentId },
      include: {
        group: true,
      },
      orderBy: {
        month: 'desc',
      },
      take: limit,
    });
  }

  // To'lov statistikasi
  async getGroupStats(groupId: string, startMonth?: Date, endMonth?: Date) {
    const where: any = { groupId };

    if (startMonth || endMonth) {
      where.month = {};
      if (startMonth) where.month.gte = new Date(startMonth);
      if (endMonth) where.month.lte = new Date(endMonth);
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        student: true,
      },
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
          stats.pendingAmount += amount;
          stats.pendingCount++;
          break;
        case PaymentStatus.OVERDUE:
          stats.overdueAmount += amount;
          stats.overdueCount++;
          break;
        case PaymentStatus.PARTIAL:
          // Partial ni pending ga qo'shamiz
          stats.pendingAmount += amount;
          stats.pendingCount++;
          break;
      }
    });

    return stats;
  }

  // Har oy uchun to'lov yaratish (barcha talabalar)
  async createMonthlyPayments(groupId: string, month: Date, amount: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        students: {
          where: { isActive: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Guruh topilmadi');
    }

    const results = await Promise.all(
      group.students.map((student) =>
        this.prisma.payment.upsert({
          where: {
            studentId_groupId_month: {
              studentId: student.id,
              groupId: groupId,
              month: new Date(month),
            },
          },
          create: {
            studentId: student.id,
            groupId: groupId,
            amount: amount,
            status: PaymentStatus.PENDING,
            month: new Date(month),
          },
          update: {},
          include: {
            student: true,
          },
        }),
      ),
    );

    return results;
  }
}