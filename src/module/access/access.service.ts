// access.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  // 🔹 random code
  private generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // 🔁 HAR 5 MINUTDA ISHLAYDI
  @Cron('*/5 * * * *')
  async refreshAccessCode() {
    // 1️⃣ eski kodlarni o'chir
    await this.prisma.accessCode.deleteMany();

    // 2️⃣ yangi code
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 3️⃣ DB ga yoz
    const newCode = await this.prisma.accessCode.create({
      data: {
        code,
        expiresAt,
      },
    });

    // 4️⃣ Admin ko'rishi uchun (hozircha console)
    console.log('🔐 NEW SITE ACCESS CODE:', code);

    return {
      code: newCode.code,
      expiresAt: newCode.expiresAt,
      message: 'Yangi kod yaratildi',
    };
  }

  // 🔍 USER TOMONIDAN TEKSHIRISH
  async checkCode(code: string) {
    const accessCode = await this.prisma.accessCode.findFirst({
      where: {
        code,
        expiresAt: { gt: new Date() },
      },
    });

    if (!accessCode) {
      throw new ForbiddenException(
        "Sayt paroli noto'g'ri yoki eskirgan",
      );
    }

    return { success: true };
  }

  // 📋 ADMIN HOZIRGI KODNI OLISH
  async getCurrentCode() {
    const accessCode = await this.prisma.accessCode.findFirst({
      where: {
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!accessCode) {
      throw new NotFoundException('Hech qanday aktiv kod topilmadi');
    }

    const now = new Date();
    const remainingTime = Math.floor(
      (accessCode.expiresAt.getTime() - now.getTime()) / 1000,
    ); // sekundlarda

    return {
      code: accessCode.code,
      expiresAt: accessCode.expiresAt,
      remainingSeconds: remainingTime,
      remainingMinutes: Math.floor(remainingTime / 60),
    };
  }
}