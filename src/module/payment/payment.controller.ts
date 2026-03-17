import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Role, PaymentStatus } from '@prisma/client';
import { JwtAuthGuard } from 'src/core/Guard/JwtGuard';
import { RolesGuard } from 'src/core/Guard/roles.guard';
import { Roles } from 'src/core/Guard/roles.decorator';

@Controller('payment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @Roles(Role.ADMIN)
  findAll(
    @Query('status') status?: PaymentStatus,
    @Query('month') month?: string,
    @Query('studentId') studentId?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.paymentService.findAll({
      status,
      month: month ? new Date(month) : undefined,
      studentId,
      groupId,
    });
  }

  @Post()
  @Roles(Role.ADMIN)
  create(
    @Body()
    createDto: {
      studentId: string;
      groupId: string;
      amount: number;
      status: PaymentStatus;
      month: Date;
      paidAt?: Date;
      extra?: any;
    },
  ) {
    return this.paymentService.create(createDto);
  }

  @Post('monthly')
  @Roles(Role.ADMIN)
  createMonthlyPayments(@Body() createDto: { groupId: string; month: Date; amount: number }) {
    return this.paymentService.createMonthlyPayments(createDto.groupId, createDto.month, createDto.amount);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body()
    updateDto: {
      amount?: number;
      status?: PaymentStatus;
      paidAt?: Date;
      extra?: any;
    },
  ) {
    return this.paymentService.update(id, updateDto);
  }

  @Get('group/:groupId')
  @Roles(Role.ADMIN)
  findByGroup(
    @Param('groupId') groupId: string,
    @Query('month') month?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentService.findByGroup(groupId, month ? new Date(month) : undefined, status);
  }

  @Get('student/:studentId')
  @Roles(Role.ADMIN)
  findByStudent(@Param('studentId') studentId: string, @Query('limit') limit?: string) {
    return this.paymentService.findByStudent(studentId, limit ? parseInt(limit) : 12);
  }

  @Get('stats/:groupId')
  @Roles(Role.ADMIN)
  getGroupStats(
    @Param('groupId') groupId: string,
    @Query('startMonth') startMonth?: string,
    @Query('endMonth') endMonth?: string,
  ) {
    return this.paymentService.getGroupStats(
      groupId,
      startMonth ? new Date(startMonth) : undefined,
      endMonth ? new Date(endMonth) : undefined,
    );
  }
}