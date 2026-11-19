import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { linkUserForStudent } from 'src/common/student-link';

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
}
