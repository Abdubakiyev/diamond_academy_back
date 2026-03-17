import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './module/auth/auth.module';
import { UserModule } from './module/user/user.module';
import { LevelModule } from './module/level/level.module';
import { TestModule } from './module/test/test.module';
import { TestResultModule } from './module/test-result/test-result.module';
import { PrismaModule } from './core/prisma/prisma.module';
import { AccessModule } from './module/access/access.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './core/prisma/prisma.service';
import { attendanceModule } from './module/attendance/attendance.module';
import { AdvertisementModule } from './module/advertisement/advertisement.module';
import { PaymentModule } from './module/payment/payment.module';
import { StudentModule } from './module/student/student.module';
import { GroupModule } from './module/group/group.module';


@Module({
  imports: [ScheduleModule.forRoot(),
    AccessModule,AuthModule, UserModule, LevelModule, TestModule, TestResultModule, PrismaModule, attendanceModule, AdvertisementModule , PaymentModule, StudentModule, GroupModule],
  controllers: [AppController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
