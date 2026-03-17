import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { Role } from '@prisma/client';
  import { ROLES_KEY, Roles } from './roles.decorator';
  
  @Injectable()
  export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}
  
    canActivate(ctx: ExecutionContext): boolean {
      const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
  
      if (!roles) return true;
  
      const req = ctx.switchToHttp().getRequest();
      const user = req.user;
  
      if (!roles.includes(user.role)) {
        throw new ForbiddenException('Sizga ruxsat yo‘q');
      }
  
      return true;
    }
  }
  