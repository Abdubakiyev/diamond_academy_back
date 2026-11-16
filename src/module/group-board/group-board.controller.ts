import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/current-user.decorator';
import { JwtGuard, Roles, RolesGuard } from '../../common/guards';
import { FeeMonthQueryDto, MonthQueryDto, SetAttendanceDto, SetDayAttendanceDto, SetFeeDto, SetPaymentDto } from './dto/group-board.dto';
import { GroupBoardService } from './group-board.service';

/** Guruh bo'yicha oylik jadval. Admin: hamma guruh, o'qituvchi: faqat o'zining guruhlari. */
@Controller('group-board')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
export class GroupBoardController {
  constructor(private readonly board: GroupBoardService) {}

  /** DIQQAT: ':groupId' dan oldin turishi shart */
  @Get('groups')
  groups(@CurrentUser() user: AuthUser, @Query() q: MonthQueryDto) {
    return this.board.listGroups(user, q.month);
  }

  @Get(':groupId')
  one(@CurrentUser() user: AuthUser, @Param('groupId', ParseUUIDPipe) groupId: string, @Query() q: MonthQueryDto) {
    return this.board.board(user, groupId, q.month);
  }

  @Put(':groupId/fee')
  setFee(@CurrentUser() user: AuthUser, @Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: SetFeeDto) {
    return this.board.setFee(user, groupId, dto);
  }

  @Delete(':groupId/fee')
  resetFee(@CurrentUser() user: AuthUser, @Param('groupId', ParseUUIDPipe) groupId: string, @Query() q: FeeMonthQueryDto) {
    return this.board.resetFee(user, groupId, q.month);
  }

  @Put(':groupId/attendance')
  attendance(@CurrentUser() user: AuthUser, @Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: SetAttendanceDto) {
    return this.board.setAttendance(user, groupId, dto);
  }

  @Put(':groupId/attendance/day')
  day(@CurrentUser() user: AuthUser, @Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: SetDayAttendanceDto) {
    return this.board.setDayAttendance(user, groupId, dto);
  }

  @Put(':groupId/payment')
  payment(@CurrentUser() user: AuthUser, @Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: SetPaymentDto) {
    return this.board.setPayment(user, groupId, dto);
  }
}
