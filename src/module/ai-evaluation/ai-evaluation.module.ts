import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ScoringModule } from '../scoring/scoring.module';
import { StorageModule } from '../storage/storage.module';
import { AiEvaluationController } from './ai-evaluation.controller';
import { AiEvaluationService } from './ai-evaluation.service';
import { AiGraderService } from './ai-grader.service';
import { SttService } from './stt.service';

@Module({
  imports: [PrismaModule, StorageModule, ScoringModule],
  controllers: [AiEvaluationController],
  providers: [AiEvaluationService, AiGraderService, SttService],
  exports: [AiEvaluationService], // urinish moduli (10): enqueueSection, getForAttempt
})
export class AiEvaluationModule {}
