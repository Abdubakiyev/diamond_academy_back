import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { timingSafeEqual } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { linkStudentByPhone } from 'src/common/student-link';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // adminKey ni ADMIN_SECRET bilan xavfsiz solishtiradi
  private isValidAdminKey(adminKey?: string): boolean {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || !adminKey) return false;

    const a = Buffer.from(adminKey);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
  }

  async register(dto: RegisterDto) {
    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      // Yangi user: ro'yxatdan o'tish
      if (!dto.name?.trim()) {
        throw new BadRequestException('Ism kiritilishi shart');
      }

      user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          phone: dto.phone,
          password: await bcrypt.hash(dto.password, 10),
          // Admin faqat to'g'ri maxfiy kalit bilan; aks holda har doim USER
          role: this.isValidAdminKey(dto.adminKey) ? Role.ADMIN : Role.USER,
        },
      });
    } else {
      // Mavjud user: kirish, parol tekshiriladi
      const invalid = new UnauthorizedException('Telefon yoki parol noto‘g‘ri');

      if (!user.isActive || !user.password) throw invalid;

      const ok = await bcrypt.compare(dto.password, user.password);
      if (!ok) throw invalid;
    }
        // Markaz o'quvchisi bo'lsa (telefon bo'yicha) Student bilan bog'laymiz
    if (user.role === Role.USER) {
      await linkStudentByPhone(this.prisma, user.id, user.phone);
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role },
      { secret: process.env.JWT_SECRET, expiresIn: '1d' },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      redirect: user.role === Role.ADMIN ? '/diamond-academy/admin' : '/',
    };
  }
}
