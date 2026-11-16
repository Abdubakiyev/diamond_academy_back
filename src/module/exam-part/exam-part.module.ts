import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ExamModule } from '../exam/exam.module';
import { StorageModule } from '../storage/storage.module';
import { ExamPartController } from './exam-part.controller';
import { ExamPartService } from './exam-part.service';

@Module({
  imports: [PrismaModule, ExamModule, StorageModule],
  controllers: [ExamPartController],
  providers: [ExamPartService],
  exports: [ExamPartService], // question moduli ishlatadi
})
export class ExamPartModule {}
