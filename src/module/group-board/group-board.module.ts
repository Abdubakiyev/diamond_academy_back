import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { GroupBoardController } from './group-board.controller';
import { GroupBoardService } from './group-board.service';

@Module({
  imports: [PrismaModule],
  controllers: [GroupBoardController],
  providers: [GroupBoardService],
})
export class GroupBoardModule {}
