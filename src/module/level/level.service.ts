import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class LevelService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLevelDto) {
    return this.prisma.level.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.level.findMany({
      include: { tests: true },
    });
  }

  async findOne(id: string) {
    const level = await this.prisma.level.findUnique({
      where: { id },
      include: { tests: true },
    });
    if (!level) throw new NotFoundException('Level not found');
    return level;
  }

  async update(id: string, dto: UpdateLevelDto) {
    return this.prisma.level.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.level.delete({
      where: { id },
    });
  }
}
