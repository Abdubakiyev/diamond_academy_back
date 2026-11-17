import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/core/Guard/JwtGuard';
import { RolesGuard } from 'src/core/Guard/roles.guard';
import { Roles } from 'src/core/Guard/roles.decorator';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('bulk')
  @Roles(Role.ADMIN, Role.TEACHER)
  createBulk(
    @Body()
    createDto: {
      groupId: string;
      date: string;
      attendances: Array<{ studentId: string; present: boolean; diamond?: boolean; extra?: any }>;
    },
  ) {
    return this.attendanceService.createBulk(createDto);
  }

  @Get('group/:groupId/date/:date')
  @Roles(Role.ADMIN, Role.TEACHER)
  findByGroupAndDate(@Param('groupId') groupId: string, @Param('date') date: string) {
    return this.attendanceService.findByGroupAndDate(groupId, new Date(date));
  }

  // Oy bo'yicha diamondlar soni: ?month=2026-11
  @Get('diamonds/:groupId')
  @Roles(Role.ADMIN, Role.TEACHER)
  diamondStats(@Param('groupId') groupId: string, @Query('month') month: string) {
    return this.attendanceService.diamondStats(groupId, month);
  }

  @Get('student/:studentId')
  @Roles(Role.ADMIN)
  findByStudent(@Param('studentId') studentId: string, @Query('limit') limit?: string) {
    return this.attendanceService.findByStudent(studentId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('stats/:groupId')
  @Roles(Role.ADMIN)
  getGroupStats(
    @Param('groupId') groupId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getGroupStats(
      groupId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
