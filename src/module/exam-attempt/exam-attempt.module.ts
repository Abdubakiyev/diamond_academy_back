import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { AiEvaluationModule } from '../ai-evaluation/ai-evaluation.module';
import { ExamPaymentModule } from '../exam-payment/exam-payment.module';
import { ScoringModule } from '../scoring/scoring.module';
import { StorageModule } from '../storage/storage.module';
import { AttemptResultService } from './attempt-result.service';
import { ExamAttemptController } from './exam-attempt.controller';
import { ExamAttemptService } from './exam-attempt.service';
import { SectionContentService } from './section-content.service';

@Module({
  imports: [PrismaModule, StorageModule, ExamPaymentModule, ScoringModule, AiEvaluationModule],
  controllers: [ExamAttemptController],
  providers: [ExamAttemptService, AttemptResultService, SectionContentService],
  exports: [ExamAttemptService],
})
export class ExamAttemptModule {}
