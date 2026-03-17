import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { PrismaModule } from 'src/core/prisma/prisma.module';


@Module({
  imports: [PrismaModule], // Bu qatorni qo'shing
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService], // Agar boshqa module'larda kerak bo'lsa
})
export class StudentModule {}