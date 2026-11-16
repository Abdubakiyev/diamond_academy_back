import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ExamModule } from '../exam/exam.module';
import { ScoreConversionController } from './score-conversion.controller';
import { ScoreConversionService } from './score-conversion.service';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';

@Module({
  imports: [PrismaModule, ExamModule],
  controllers: [ScoreConversionController, ScoringController],
  providers: [ScoreConversionService, ScoringService],
  exports: [ScoringService, ScoreConversionService], // AI baholash (9) va urinish (10) modullari ishlatadi
})
export class ScoringModule {}
