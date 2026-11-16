import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ExamController],
  providers: [ExamService],
  exports: [ExamService], // part / savol / urinish modullari ishlatadi
})
export class ExamModule {}
