import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PassportModule } from '@nestjs/passport';


@Module({
  imports: [PrismaModule,AuthModule,PassportModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
