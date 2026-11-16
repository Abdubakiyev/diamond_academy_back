import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';

export type AuthUser = {
  id: string;
  role: Role;
};

/**
 * JWT dan o'tgan foydalanuvchini oladi.
 * JwtStrategy.validate() qaytargan obyektda id `id`, `userId` yoki `sub` nomida bo'lishi mumkin,
 * hammasini shu yerda bir xil ko'rinishga keltiramiz.
 *
 *   @CurrentUser() user: AuthUser
 *   @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const raw = ctx.switchToHttp().getRequest().user ?? {};
    const user: AuthUser = {
      id: raw.id ?? raw.userId ?? raw.sub,
      role: raw.role,
    };
    return field ? user[field] : user;
  },
);
