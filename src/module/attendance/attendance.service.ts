import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';


@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // Davomat qo'shish (bir necha talaba uchun)
  async createBulk(data: {
    groupId: string;
    date: Date;
    attendances: Array<{ studentId: string; present: boolean; extra?: any }>;
  }) {
    const group = await this.prisma.group.findUnique({
      where: { id: data.groupId },
      include: {
        students: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Guruh topilmadi');
    }

    // Har bir talaba uchun davomat yaratish yoki yangilash
    const results = await Promise.all(
      data.attendances.map((att) =>
        this.prisma.attendance.upsert({
          where: {
            studentId_groupId_date: {
              studentId: att.studentId,
              groupId: data.groupId,
              date: new Date(data.date),
            },
          },
          create: {
            studentId: att.studentId,
            groupId: data.groupId,
            date: new Date(data.date),
            present: att.present,
            extra: att.extra,
          },
          update: {
            present: att.present,
            extra: att.extra,
          },
          include: {
            student: true,
          },
        }),
      ),
    );

    return results;
  }

  // Guruh va sana bo'yicha davomat
  async findByGroupAndDate(groupId: string, date: Date) {
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

    const attendances = await this.prisma.attendance.findMany({
      where: {
        groupId,
        date: new Date(date),
      },
      include: {
        student: true,
      },
    });

    // Barcha talabalar uchun davomat (mavjud bo'lmasa present: false)
    return group.students.map((student) => {
      const attendance = attendances.find((a) => a.studentId === student.id);
      return {
        student,
        present: attendance?.present || false,
        extra: attendance?.extra,
        attendanceId: attendance?.id,
      };
    });
  }

  // Talaba davomati tarixi
  async findByStudent(studentId: string, limit = 20) {
    return this.prisma.attendance.findMany({
      where: { studentId },
      include: {
        group: true,
      },
      orderBy: {
        date: 'desc',
      },
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
      include: {
        student: true,
      },
    });

    // Har bir talaba uchun statistika
    const studentStats = new Map();

    attendances.forEach((att) => {
      if (!studentStats.has(att.studentId)) {
        studentStats.set(att.studentId, {
          student: att.student,
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
        });
      }

      const stats = studentStats.get(att.studentId);
      stats.totalDays++;
      if (att.present) {
        stats.presentDays++;
      } else {
        stats.absentDays++;
      }
    });

    return Array.from(studentStats.values()).map((stats) => ({
      ...stats,
      attendanceRate: stats.totalDays > 0 ? ((stats.presentDays / stats.totalDays) * 100).toFixed(1) : 0,
    }));
  }
}