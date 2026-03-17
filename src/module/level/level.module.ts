import { Module } from '@nestjs/common';
import { LevelService } from './level.service';
import { LevelController } from './level.controller';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module'; // JwtStrategy ni ishlatish uchun

@Module({
  imports: [PrismaModule, PassportModule, AuthModule], // AuthModule import qilinadi
  controllers: [LevelController],
  providers: [LevelService],
})
export class LevelModule {}
