import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { CenterStudentController } from './center-student.controller';
import { CenterStudentService } from './center-student.service';
import { ExamAccessService } from './exam-access.service';
import { ExamPaymentController } from './exam-payment.controller';
import { ExamPaymentService } from './exam-payment.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExamPaymentController, CenterStudentController],
  providers: [ExamPaymentService, ExamAccessService, CenterStudentService],
  exports: [ExamAccessService, ExamPaymentService], // urinish moduli (10) va kelajakdagi webhooklar ishlatadi
})
export class ExamPaymentModule {}
