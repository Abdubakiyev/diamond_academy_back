import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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
          role: Role.USER, // rolni foydalanuvchi tanlay olmaydi
        },
      });
    } else {
      // Mavjud user: kirish, parol tekshiriladi
      const invalid = new UnauthorizedException('Telefon yoki parol noto‘g‘ri');

      if (!user.isActive || !user.password) throw invalid;

      const ok = await bcrypt.compare(dto.password, user.password);
      if (!ok) throw invalid;
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
