import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { DATE_RE, MONTH_RE, SetAttendanceDto, SetDayAttendanceDto, SetFeeDto, SetPaymentDto } from './dto/group-board.dto';

const monthStart = (m: string): Date => {
  const x = MONTH_RE.exec(m);
  if (!x) throw new BadRequestException('Oy YYYY-MM ko‘rinishida bo‘lishi kerak');
  return new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1));
};
const nextMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const ym = (d: Date) => d.toISOString().slice(0, 7);

const parseDate = (s: string): Date => {
  if (!DATE_RE.test(s)) throw new BadRequestException('Sana YYYY-MM-DD ko‘rinishida bo‘lishi kerak');
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new BadRequestException('Sana noto‘g‘ri');
  }
  return date;
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

/** Guruh bo'yicha oylik jadval: o'quvchilar, oylik to'lov, davomat va diamond */
@Injectable()
export class GroupBoardService {
  constructor(private readonly prisma: PrismaService) {}

  /** ADMIN: hamma guruh. TEACHER: faqat o'ziniki. */
  private async assertAccess(user: AuthUser, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        schedule: true,
        teacherId: true,
        level: { select: { id: true, type: true } },
        teacher: { select: { id: true, name: true } },
      },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (user.role === Role.TEACHER && group.teacherId !== user.id) {
      throw new ForbiddenException('Bu guruh sizga biriktirilmagan');
    }
    return group;
  }

  private async assertStudents(groupId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const count = await this.prisma.student.count({ where: { groupId, id: { in: unique } } });
    if (count !== unique.length) throw new BadRequestException('O‘quvchi bu guruhga tegishli emas');
  }

  /** Oy uchun amaldagi summa: shu oyniki, bo'lmasa undan oldingi oxirgisi */
  private async effectiveFee(groupId: string, month: Date) {
    const f = await this.prisma.groupFee.findFirst({
      where: { groupId, month: { lte: month } },
      orderBy: { month: 'desc' },
      select: { month: true, amount: true },
    });
    if (!f) return { amount: null as number | null, inherited: false, fromMonth: null as string | null };
    return { amount: Number(f.amount), inherited: f.month.getTime() !== month.getTime(), fromMonth: ym(f.month) };
  }

  /* ───────────── Guruhlar ro'yxati ───────────── */

  async listGroups(user: AuthUser, monthStr?: string) {
    const month = monthStart(monthStr ?? currentMonth());
    const groups = await this.prisma.group.findMany({
      where: { isActive: true, ...(user.role === Role.TEACHER ? { teacherId: user.id } : {}) },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        schedule: true,
        level: { select: { id: true, type: true } },
        teacher: { select: { id: true, name: true } },
        _count: { select: { students: { where: { isActive: true } } } },
      },
    });
    const ids = groups.map((g) => g.id);

    const [fees, paid] = await Promise.all([
      this.prisma.groupFee.findMany({
        where: { groupId: { in: ids }, month: { lte: month } },
        orderBy: { month: 'desc' },
        select: { groupId: true, amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['groupId'],
        where: { groupId: { in: ids }, month, status: PaymentStatus.PAID, student: { isActive: true } },
        _count: { _all: true },
      }),
    ]);
    const feeBy = new Map<string, number>();
    for (const f of fees) if (!feeBy.has(f.groupId)) feeBy.set(f.groupId, Number(f.amount));
    const paidBy = new Map(paid.map((p) => [p.groupId, p._count._all]));

    return {
      month: ym(month),
      items: groups.map((g) => ({
        id: g.id,
        name: g.name,
        schedule: g.schedule,
        level: g.level,
        teacher: g.teacher,
        studentCount: g._count.students,
        paidCount: paidBy.get(g.id) ?? 0,
        fee: feeBy.get(g.id) ?? null,
      })),
    };
  }

  /* ───────────── Guruh jadvali ───────────── */

  async board(user: AuthUser, groupId: string, monthStr?: string) {
    const group = await this.assertAccess(user, groupId);
    const month = monthStart(monthStr ?? currentMonth());
    const end = nextMonth(month);

    const [students, attendances, payments, fee] = await Promise.all([
      this.prisma.student.findMany({
        where: { groupId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, phone: true },
      }),
      this.prisma.attendance.findMany({
        where: { groupId, date: { gte: month, lt: end } },
        select: { studentId: true, date: true, present: true, diamond: true },
      }),
      this.prisma.payment.findMany({
        where: { groupId, month },
        select: { studentId: true, status: true, amount: true, paidAt: true },
      }),
      this.effectiveFee(groupId, month),
    ]);

    const attBy = new Map<string, Record<string, { present: boolean; diamond: boolean }>>();
    const days = new Set<string>();
    for (const a of attendances) {
      const d = ymd(a.date);
      days.add(d);
      const rec = attBy.get(a.studentId) ?? {};
      rec[d] = { present: a.present, diamond: a.diamond };
      attBy.set(a.studentId, rec);
    }
    const payBy = new Map(payments.map((p) => [p.studentId, p]));

    const rows = students.map((s) => {
      const p = payBy.get(s.id);
      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        payment: {
          paid: p?.status === PaymentStatus.PAID,
          status: p?.status ?? null,
          amount: p ? Number(p.amount) : null,
          paidAt: p?.paidAt ?? null,
        },
        attendance: attBy.get(s.id) ?? {},
      };
    });

    const paidRows = rows.filter((r) => r.payment.paid);
    return {
      group: { id: group.id, name: group.name, schedule: group.schedule, level: group.level, teacher: group.teacher },
      month: ym(month),
      fee,
      days: [...days].sort(),
      students: rows,
      totals: {
        students: rows.length,
        paid: paidRows.length,
        unpaid: rows.length - paidRows.length,
        expected: fee.amount != null ? fee.amount * rows.length : null,
        collected: paidRows.reduce((sum, r) => sum + (r.payment.amount ?? 0), 0),
      },
    };
  }

  /* ───────────── Oylik summa (bir marta kiritiladi, keyingi oylarga o'tadi) ───────────── */

  async setFee(user: AuthUser, groupId: string, dto: SetFeeDto) {
    await this.assertAccess(user, groupId);
    const month = monthStart(dto.month);

    await this.prisma.$transaction([
      this.prisma.groupFee.upsert({
        where: { groupId_month: { groupId, month } },
        create: { groupId, month, amount: dto.amount },
        update: { amount: dto.amount },
      }),
      // To'lanmagan (kutilayotgan) yozuvlar yangi summaga o'tadi. To'langanlari o'zgarmaydi.
      this.prisma.payment.updateMany({
        where: { groupId, month, status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] } },
        data: { amount: dto.amount },
      }),
    ]);
    return this.effectiveFee(groupId, month);
  }

  /** Shu oyning o'z summasini olib tashlaydi: oldingi oydagi summa qaytadan amal qiladi */
  async resetFee(user: AuthUser, groupId: string, monthStr: string) {
    await this.assertAccess(user, groupId);
    const month = monthStart(monthStr);
    await this.prisma.groupFee.deleteMany({ where: { groupId, month } });
    return this.effectiveFee(groupId, month);
  }

  /* ───────────── Davomat va diamond ───────────── */

  private attendanceOps(groupId: string, date: Date, rec: { studentId: string; present?: boolean | null; diamond?: boolean }) {
    const where = { studentId_groupId_date: { studentId: rec.studentId, groupId, date } };
    if (rec.present === null || rec.present === undefined) {
      return this.prisma.attendance.deleteMany({ where: { studentId: rec.studentId, groupId, date } });
    }
    const diamond = rec.present ? !!rec.diamond : false;
    return this.prisma.attendance.upsert({
      where,
      create: { studentId: rec.studentId, groupId, date, present: rec.present, diamond },
      update: { present: rec.present, diamond },
    });
  }

  async setAttendance(user: AuthUser, groupId: string, dto: SetAttendanceDto) {
    await this.assertAccess(user, groupId);
    await this.assertStudents(groupId, [dto.studentId]);
    const date = parseDate(dto.date);
    await this.attendanceOps(groupId, date, dto);
    return { studentId: dto.studentId, date: dto.date, present: dto.present ?? null, diamond: dto.present ? !!dto.diamond : false };
  }

  /** Bir kunlik davomatni butun guruh uchun birdan saqlash */
  async setDayAttendance(user: AuthUser, groupId: string, dto: SetDayAttendanceDto) {
    await this.assertAccess(user, groupId);
    const date = parseDate(dto.date);
    const ids = dto.records.map((r) => r.studentId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Bitta o‘quvchi ikki marta yuborilgan');
    await this.assertStudents(groupId, ids);

    await this.prisma.$transaction(dto.records.map((r) => this.attendanceOps(groupId, date, r)));
    return { date: dto.date, saved: dto.records.length };
  }

  /* ───────────── Oylik to'lov belgisi ───────────── */

  async setPayment(user: AuthUser, groupId: string, dto: SetPaymentDto) {
    await this.assertAccess(user, groupId);
    await this.assertStudents(groupId, [dto.studentId]);
    const month = monthStart(dto.month);
    const where = { studentId_groupId_month: { studentId: dto.studentId, groupId, month } };

    if (!dto.paid) {
      const existing = await this.prisma.payment.findUnique({ where, select: { id: true } });
      if (existing) {
        await this.prisma.payment.update({ where, data: { status: PaymentStatus.PENDING, paidAt: null } });
      }
      return { studentId: dto.studentId, month: dto.month, paid: false };
    }

    let amount = dto.amount;
    if (amount === undefined) {
      const fee = await this.effectiveFee(groupId, month);
      amount = fee.amount ?? undefined;
    }
    if (amount === undefined) throw new BadRequestException('Avval guruhning oylik to‘lov summasini kiriting');

    const data: Prisma.PaymentUncheckedUpdateInput = { status: PaymentStatus.PAID, paidAt: new Date(), amount };
    await this.prisma.payment.upsert({
      where,
      create: { studentId: dto.studentId, groupId, month, status: PaymentStatus.PAID, paidAt: new Date(), amount },
      update: data,
    });
    return { studentId: dto.studentId, month: dto.month, paid: true, amount };
  }
}
