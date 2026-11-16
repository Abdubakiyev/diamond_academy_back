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
import { CourseModule } from './module/course/course.module';
import { LessonModule } from './module/lesson/lesson.module';
import { AssignmentModule } from './module/assignment/assignment.module';
import { ExamModule } from './module/exam/exam.module';
import { ExamAttemptModule } from './module/exam-attempt/exam-attempt.module';
import { ExamPaymentModule } from './module/exam-payment/exam-payment.module';
import { AiEvaluationModule } from './module/ai-evaluation/ai-evaluation.module';
import { StorageModule } from './module/storage/storage.module';
import { GroupBoardModule } from './module/group-board/group-board.module';
import { ExamPartModule } from './module/exam-part/exam-part.module';
import { QuestionModule } from './module/question/question.module';
import { ScoringModule } from './module/scoring/scoring.module';
@Module({
  imports: [ScheduleModule.forRoot(),
    AccessModule,AuthModule, UserModule, LevelModule, TestModule, TestResultModule, PrismaModule, attendanceModule, AdvertisementModule , PaymentModule, StudentModule, GroupModule, CourseModule, LessonModule, AssignmentModule, ExamModule, ExamAttemptModule, ExamPaymentModule, AiEvaluationModule, StorageModule,GroupBoardModule, GroupBoardModule, ExamPartModule, QuestionModule, ScoringModule],
  controllers: [AppController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
