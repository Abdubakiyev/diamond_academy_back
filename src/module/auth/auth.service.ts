import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // oldin telefon orqali user mavjudligini tekshirish
    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      // agar role yuborilgan bo'lsa o'shani, yo'q bo'lsa USER
      const role = dto.role ?? Role.USER;

      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          role: role,
        },
      });
    }

    const payload = {
      sub: user.id,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1d',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      redirect:
        user.role === Role.ADMIN
          ? '/diamond-academy/admin'
          : '/',
    };
  }
}
