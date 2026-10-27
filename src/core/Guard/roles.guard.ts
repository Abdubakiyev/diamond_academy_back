import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';

interface AuthenticatedRequest extends Request {
  user?: { role?: Role };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // @Roles() berilmagan bo'lsa — rol bo'yicha cheklov yo'q
    if (!roles) return true;

    const { user } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    // JwtAuthGuard ishlamagan (yoki RolesGuard undan oldin turgan) bo'lsa,
    // user yo'q bo'ladi: 500 emas, 401 qaytaramiz
    if (!user) {
      throw new UnauthorizedException('Avval tizimga kiring');
    }

    if (!user.role || !roles.includes(user.role)) {
      throw new ForbiddenException('Sizga ruxsat yo‘q');
    }

    return true;
  }
}
