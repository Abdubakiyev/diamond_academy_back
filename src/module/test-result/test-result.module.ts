import { Module } from '@nestjs/common';
import { TestResultService } from './test-result.service';
import { TestResultController } from './test-result.controller';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PassportModule } from '@nestjs/passport';


@Module({
  imports: [PrismaModule,AuthModule,PassportModule],
  controllers: [TestResultController],
  providers: [TestResultService],
})
export class TestResultModule {}
