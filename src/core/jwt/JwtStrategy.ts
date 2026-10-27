import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PrismaService } from 'src/core/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

interface JwtUser {
  id: string;
  name: string;
  phone: string;
  role: string;
}

interface JwtUserLookup {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; name: true; phone: true; role: true };
    }): Promise<JwtUser | null>;
  };
}

// Sir yo'q bo'lsa, ilova ishga tushishining o'zidayoq aniq xabar bilan to'xtaydi
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET muhit o‘zgaruvchisi topilmadi (.env yoki Render Environment ni tekshiring)',
    );
  }
  return secret;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: (request) => {
        const authorization = request?.headers?.authorization;
        if (typeof authorization !== 'string') {
          return null;
        }

        const [scheme, token] = authorization.split(' ');
        return scheme?.toLowerCase() === 'bearer' ? (token ?? null) : null;
      },
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token payloadda sub yo‘q');
    }

    // Rol har so'rovda bazadan olinadi, shuning uchun admin rolni o'zgartirsa,
    // eski token bilan eski rol ishlab qolmaydi
    const user = await (
      this.prisma as unknown as JwtUserLookup
    ).user.findUnique({
      where: { id: payload.sub },
      // req.user ga faqat kerakli maydonlar (butun yozuv emas)
      select: { id: true, name: true, phone: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('User topilmadi');
    }

    return user; // req.user = user
  }
}
