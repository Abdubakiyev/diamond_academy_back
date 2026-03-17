import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class TestService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTestDto) {
    return this.prisma.test.create({ data: dto });
  }

  async findAll() {
    return this.prisma.test.findMany({ include: { level: true } });
  }

  async findOne(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { level: true },
    });
    if (!test) throw new NotFoundException('Test not found');
    return test;
  }

  async update(id: string, dto: UpdateTestDto) {
    return this.prisma.test.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.test.delete({ where: { id } });
  }
}
