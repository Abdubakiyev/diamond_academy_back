import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { linkUserForStudent } from 'src/common/student-link';

type StudentWithGroup = Prisma.StudentGetPayload<{ include: { group: { include: { level: true } } } }>;

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  // Talaba qo'shish
  async create(data: { name: string; phone?: string; groupId: string }) {
    const group = await this.prisma.group.findUnique({
      where: { id: data.groupId },
    });

    if (!group) {
      throw new NotFoundException('Guruh topilmadi');
    }

    const created = await this.prisma.student.create({
      data: {
        name: data.name,
        phone: data.phone,
        groupId: data.groupId,
      },
    });

    // Shu telefon bilan ro'yxatdan o'tgan User bo'lsa, bog'laymiz
    await linkUserForStudent(this.prisma, created.id, data.phone);

    return this.prisma.student.findUnique({
      where: { id: created.id },
      include: { group: true },
    });
  }

  // Barcha talabalar
  async findAll(groupId?: string) {
    return this.prisma.student.findMany({
      where: groupId ? { groupId } : {},
      include: {
        group: {
          include: {
            level: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  // Guruh bo'yicha talabalar
  async findByGroup(groupId: string) {
    return this.prisma.student.findMany({
      where: { groupId, isActive: true },
      orderBy: {
        name: 'asc',
      },
    });
  }

  // Bitta talaba
  async findOne(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        group: {
          include: {
            level: true,
          },
        },
        attendances: {
          orderBy: {
            date: 'desc',
          },
          take: 10,
        },
        payments: {
          orderBy: {
            month: 'desc',
          },
          take: 6,
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Talaba topilmadi');
    }

    return student;
  }

  // Tahrirlash
  async update(id: string, data: { name?: string; phone?: string; groupId?: string; isActive?: boolean }) {
    const student = await this.prisma.student.findUnique({ where: { id } });

    if (!student) {
      throw new NotFoundException('Talaba topilmadi');
    }

    if (data.groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: data.groupId },
      });

      if (!group) {
        throw new NotFoundException('Guruh topilmadi');
      }
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data,
      include: {
        group: true,
      },
    });

    // Telefon berilgan va hali akkauntga bog'lanmagan bo'lsa, bog'lashga urinamiz
    if (data.phone && !updated.userId) {
      await linkUserForStudent(this.prisma, id, data.phone);
      return this.prisma.student.findUnique({
        where: { id },
        include: { group: true },
      });
    }

    return updated;
  }

  // O'chirish
  async remove(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });

    if (!student) {
      throw new NotFoundException('Talaba topilmadi');
    }

    return this.prisma.student.delete({
      where: { id },
    });
  }

  /* ───────────── Statistika ───────────── */

  // O'quvchining o'z statistikasi (kirgan user bo'yicha)
  async myStats(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { group: { include: { level: true } } },
    });

    // Akkaunt hali o'quvchi yozuviga bog'lanmagan (markaz o'quvchisi emas)
    if (!student) return { isStudent: false as const };

    return this.buildStats(student);
  }

  // Ota-ona uchun: o'quvchi id bo'yicha (ruxsatni chaqiruvchi tekshiradi!)
  async statsByStudentId(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { group: { include: { level: true } } },
    });
    if (!student) throw new NotFoundException('Talaba topilmadi');

    return this.buildStats(student);
  }

  private async buildStats(student: StudentWithGroup) {
    // Tashkent vaqti (UTC+5) bo'yicha joriy oyning 1-sanasi
    const local = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const currentMonth = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1));

    const [attendances, payments, fee, attempts] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { studentId: student.id },
        orderBy: { date: 'desc' },
        select: { date: true, present: true, diamond: true, extra: true },
      }),
      this.prisma.payment.findMany({
        where: { studentId: student.id },
        orderBy: { month: 'desc' },
        take: 12,
        select: { id: true, month: true, amount: true, status: true, paidAt: true },
      }),
      this.prisma.groupFee.findFirst({
        where: { groupId: student.groupId, month: { lte: currentMonth } },
        orderBy: { month: 'desc' },
      }),
      // O'quvchining saytda akkaunti bo'lmasa, imtihonlar bo'sh qaytadi
      this.prisma.examAttempt.findMany({
        where: { userId: student.userId ?? 'no-user', status: { not: 'IN_PROGRESS' } },
        orderBy: { startedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          listeningScore: true,
          readingScore: true,
          writingScore: true,
          speakingScore: true,
          totalScore: true,
          cefrLevel: true,
          exam: { select: { id: true, title: true } },
        },
      }),
    ]);

    // Davomat
    const total = attendances.length;
    const present = attendances.filter((a) => a.present).length;
    const diamonds = attendances.filter((a) => a.diamond).length;

    // Joriy oy to'lovi
    const currentPayment = payments.find((p) => p.month.getTime() === currentMonth.getTime());
    const feeAmount = fee ? Number(fee.amount) : null;

    // Imtihonlar
    const done = attempts.filter((a) => a.totalScore !== null);
    const best = done.reduce<number | null>(
      (m, a) => (a.totalScore !== null && (m === null || a.totalScore > m) ? a.totalScore : m),
      null,
    );

    return {
      isStudent: true as const,
      student: {
        id: student.id,
        name: student.name,
        phone: student.phone,
        isActive: student.isActive,
        group: { id: student.group.id, name: student.group.name, schedule: student.group.schedule },
        level: student.group.level?.type ?? null,
      },
      attendance: {
        total,
        present,
        absent: total - present,
        rate: total ? Math.round((present / total) * 100) : null, // foiz
        recent: attendances.slice(0, 30).map((a) => ({
          date: a.date,
          present: a.present,
          diamond: a.diamond,
        })),
      },
      diamonds, // jami olmoslar soni
      payment: {
        currentMonth: {
          month: currentMonth,
          // status null = bu oy uchun yozuv yo'q
          status: currentPayment?.status ?? null,
          amount: currentPayment ? Number(currentPayment.amount) : feeAmount,
          paidAt: currentPayment?.paidAt ?? null,
        },
        history: payments.map((p) => ({
          id: p.id,
          month: p.month,
          amount: Number(p.amount),
          status: p.status,
          paidAt: p.paidAt,
        })),
      },
      exams: {
        count: done.length,
        bestScore: best,
        lastCefr: done[0]?.cefrLevel ?? null,
        attempts: attempts.map((a) => ({
          id: a.id,
          examId: a.exam.id,
          title: a.exam.title,
          status: a.status,
          startedAt: a.startedAt,
          finishedAt: a.finishedAt,
          listening: a.listeningScore,
          reading: a.readingScore,
          writing: a.writingScore,
          speaking: a.speakingScore,
          total: a.totalScore,
          cefr: a.cefrLevel,
        })),
      },
    };
  }
}
