import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { CourseModule } from '../course/course.module';
import { StorageModule } from '../storage/storage.module';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';

@Module({
  imports: [PrismaModule, CourseModule, StorageModule],
  controllers: [LessonController],
  providers: [LessonService],
  exports: [LessonService], // assignment moduli ham ishlatishi mumkin
})
export class LessonModule {}
