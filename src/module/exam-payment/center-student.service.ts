import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { BulkCenterStudentDto, CenterStudentQueryDto } from './dto/center-student.dto';

const userSelect = { id: true, name: true, phone: true, role: true, isActive: true, isCenterStudent: true } satisfies Prisma.UserSelect;

/** Admin "shu o'quv markazida o'qiydi" belgisini boshqaradi: true bo'lsa, testlar bepul */
@Injectable()
export class CenterStudentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CenterStudentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = {
      role: Role.USER,
      ...(query.isCenterStudent !== undefined ? { isCenterStudent: query.isCenterStudent } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: userSelect,
      }),
    ]);
    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async set(userId: string, isCenterStudent: boolean) {
    const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Foydalanuvchi topilmadi');
    return this.prisma.user.update({ where: { id: userId }, data: { isCenterStudent }, select: userSelect });
  }

  /** Faqat oddiy foydalanuvchilar (USER) uchun; admin / o'qituvchi baribir bepul */
  async bulk(dto: BulkCenterStudentDto) {
    const res = await this.prisma.user.updateMany({
      where: { id: { in: dto.userIds }, role: Role.USER },
      data: { isCenterStudent: dto.isCenterStudent },
    });
    return { updated: res.count, requested: dto.userIds.length };
  }
}
