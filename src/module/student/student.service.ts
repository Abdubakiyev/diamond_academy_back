import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';


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

    return this.prisma.student.create({
      data: {
        name: data.name,
        phone: data.phone,
        groupId: data.groupId,
      },
      include: {
        group: true,
      },
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

    return this.prisma.student.update({
      where: { id },
      data,
      include: {
        group: true,
      },
    });
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
}