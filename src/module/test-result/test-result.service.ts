import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTestResultDto } from './dto/create-test-result.dto';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { UpdateTestResultDto } from './dto/update-test-result.dto';

@Injectable()
export class TestResultService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTestResultDto) {
    if (!userId) throw new Error("userId is required");
  
    const tests = await this.prisma.test.findMany({
      where: { levelId: dto.levelId },
    });
  
    if (!tests.length) throw new NotFoundException('Tests not found for this level');
  
    let correctCount = 0;
    let wrongCount = 0;
  
    const testMap = new Map(tests.map(t => [t.id, t.correct]));
  
    for (const ans of dto.answers) {
      if (testMap.get(ans.testId) === ans.answer) correctCount++;
      else wrongCount++;
    }
  
    return this.prisma.testResult.create({
      data: {
        userId,      // ✅ userId keladi
        levelId: dto.levelId,
        correctCount,
        wrongCount,
      },
    });
  }
  

  // 🔐 User / Admin natijalar
  async findAll(userId: string, role: string) {
    if (role === 'ADMIN') {
      return this.prisma.testResult.findMany({
        include: { user: true, level: true },
      });
    }

    return this.prisma.testResult.findMany({
      where: { userId },
      include: { level: true },
    });
  }

  async findOne(id: string) {
    const result = await this.prisma.testResult.findUnique({
      where: { id },
      include: { user: true, level: true },
    });

    if (!result) throw new NotFoundException('Result not found');
    return result;
  }

  async update(id: string, dto: UpdateTestResultDto) {
    const existing = await this.prisma.testResult.findUnique({
      where: { id },
    });
  
    if (!existing) {
      throw new NotFoundException('Result not found');
    }
  
    return this.prisma.testResult.update({
      where: { id },
      data: {
        correctCount: dto.correctCount ?? existing.correctCount,
        wrongCount: dto.wrongCount ?? existing.wrongCount,
      },
    });
  }  

  async remove(id: string) {
    const existing = await this.prisma.testResult.findUnique({
      where: { id },
    });
  
    if (!existing) {
      throw new NotFoundException('Result not found');
    }
  
    return this.prisma.testResult.delete({
      where: { id },
    });
  }  
  
}
