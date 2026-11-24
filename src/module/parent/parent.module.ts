import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { StudentModule } from '../student/student.module';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';

@Module({
  imports: [PrismaModule, StudentModule, JwtModule.register({})],
  controllers: [ParentController],
  providers: [ParentService],
})
export class ParentModule {}
