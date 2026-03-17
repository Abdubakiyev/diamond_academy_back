import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';


@Injectable()
export class GroupService {
  constructor(private prisma: PrismaService) {}

  // Guruh qo'shish
  async create(data: { name: string; levelId: string; schedule?: string }) {
    const existing = await this.prisma.group.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictException('Bu nomli guruh allaqachon mavjud');
    }

    const level = await this.prisma.level.findUnique({
      where: { id: data.levelId },
    });

    if (!level) {
      throw new NotFoundException('Level topilmadi');
    }

    return this.prisma.group.create({
      data: {
        name: data.name,
        levelId: data.levelId,
        schedule: data.schedule,
      },
      include: {
        level: true,
      },
    });
  }

  // Barcha guruhlar
  async findAll(isActive?: boolean) {
    return this.prisma.group.findMany({
      where: isActive !== undefined ? { isActive } : {},
      include: {
        level: true,
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  // Bitta guruh (talabalar bilan)
  async findOne(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        level: true,
        students: {
          where: { isActive: true },
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Guruh topilmadi');
    }

    return group;
  }

  // Tahrirlash
  async update(id: string, data: { name?: string; levelId?: string; schedule?: string; isActive?: boolean }) {
    const group = await this.prisma.group.findUnique({ where: { id } });

    if (!group) {
      throw new NotFoundException('Guruh topilmadi');
    }

    if (data.name && data.name !== group.name) {
      const existing = await this.prisma.group.findUnique({
        where: { name: data.name },
      });

      if (existing) {
        throw new ConflictException('Bu nomli guruh allaqachon mavjud');
      }
    }

    return this.prisma.group.update({
      where: { id },
      data,
      include: {
        level: true,
      },
    });
  }

  // O'chirish
  async remove(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Guruh topilmadi');
    }

    if (group._count.students > 0) {
      throw new ConflictException('Guruhda talabalar bor, avval ularni o\'chiring');
    }

    return this.prisma.group.delete({
      where: { id },
    });
  }
}