import { Module } from '@nestjs/common';
import { TestService } from './test.service';
import { TestController } from './test.controller';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PassportModule } from '@nestjs/passport';


@Module({
  imports: [PrismaModule, AuthModule,PassportModule],
  controllers: [TestController],
  providers: [TestService],
})
export class TestModule {}
