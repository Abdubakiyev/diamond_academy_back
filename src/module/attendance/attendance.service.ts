import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // Davomat qo'shish (bir necha talaba uchun)
  async createBulk(data: {
    groupId: string;
    date: Date | string;
    attendances: Array<{ studentId: string; present: boolean; diamond?: boolean; extra?: any }>;
  }) {
    const group = await this.prisma.group.findUnique({ where: { id: data.groupId } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const date = new Date(data.date);
    if (isNaN(date.getTime())) throw new BadRequestException('Sana noto‘g‘ri');

    return this.prisma.$transaction(
      data.attendances.map((att) => {
        // Kelmagan o'quvchi diamond olmaydi
        const diamond = att.present ? (att.diamond ?? false) : false;

        return this.prisma.attendance.upsert({
          where: {
            studentId_groupId_date: {
              studentId: att.studentId,
              groupId: data.groupId,
              date,
            },
          },
          create: {
            studentId: att.studentId,
            groupId: data.groupId,
            date,
            present: att.present,
            diamond,
            extra: att.extra,
          },
          update: {
            present: att.present,
            // diamond yuborilmasa yoki kelmagan bo'lsa, mavjud qiymat to'g'ri saqlanadi/tozalanadi
            ...(att.diamond !== undefined || !att.present ? { diamond } : {}),
            ...(att.extra !== undefined && { extra: att.extra }),
          },
          include: { student: true },
        });
      }),
    );
  }

  // Guruh va sana bo'yicha davomat
  async findByGroupAndDate(groupId: string, date: Date) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { students: { where: { isActive: true } } },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const attendances = await this.prisma.attendance.findMany({
      where: { groupId, date: new Date(date) },
    });

    // Barcha talabalar uchun davomat (mavjud bo'lmasa present: false)
    return group.students.map((student) => {
      const attendance = attendances.find((a) => a.studentId === student.id);
      return {
        student,
        present: attendance?.present ?? false,
        diamond: attendance?.diamond ?? false,
        extra: attendance?.extra,
        attendanceId: attendance?.id,
      };
    });
  }

  // Oy bo'yicha diamondlar soni (jami va o'quvchi bo'yicha)
  async diamondStats(groupId: string, monthInput: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(monthInput ?? '');
    if (!m) throw new BadRequestException('Oy noto‘g‘ri (2026-11 ko‘rinishida)');

    const from = new Date(Date.UTC(+m[1], +m[2] - 1, 1));
    const to = new Date(Date.UTC(+m[1], +m[2], 1));

    const rows = await this.prisma.attendance.groupBy({
      by: ['studentId'],
      where: { groupId, diamond: true, date: { gte: from, lt: to } },
      _count: { _all: true },
    });

    const byStudent: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byStudent[r.studentId] = r._count._all;
      total += r._count._all;
    }
    return { total, byStudent };
  }

  // Talaba davomati tarixi
  async findByStudent(studentId: string, limit = 20) {
    return this.prisma.attendance.findMany({
      where: { studentId },
      include: { group: true },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  // Guruh davomati statistikasi
  async getGroupStats(groupId: string, startDate?: Date, endDate?: Date) {
    const where: any = { groupId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const attendances = await this.prisma.attendance.findMany({
      where,
      include: { student: true },
    });

    const studentStats = new Map();

    attendances.forEach((att) => {
      if (!studentStats.has(att.studentId)) {
        studentStats.set(att.studentId, {
          student: att.student,
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          diamonds: 0,
        });
      }

      const stats = studentStats.get(att.studentId);
      stats.totalDays++;
      if (att.present) stats.presentDays++;
      else stats.absentDays++;
      if (att.diamond) stats.diamonds++;
    });

    return Array.from(studentStats.values()).map((stats) => ({
      ...stats,
      attendanceRate:
        stats.totalDays > 0 ? ((stats.presentDays / stats.totalDays) * 100).toFixed(1) : 0,
    }));
  }
}
