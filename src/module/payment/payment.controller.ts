import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
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
    @Query('month') month?: string, // "2026-11"
    @Query('studentId') studentId?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.paymentService.findAll({ status, month, studentId, groupId });
  }

  // Yangi qator yaratadi (mavjud bo'lsa 409)
  @Post()
  @Roles(Role.ADMIN)
  create(
    @Body()
    dto: {
      studentId: string;
      groupId: string;
      amount: number;
      status: PaymentStatus;
      month: string;
      paidAt?: string;
      extra?: any;
    },
  ) {
    return this.paymentService.create(dto);
  }

  // Bitta student uchun to'lovni belgilash (yaratadi yoki yangilaydi)
  @Put('student')
  @Roles(Role.ADMIN, Role.TEACHER)
  setStudentPayment(
    @Body()
    dto: {
      studentId: string;
      groupId: string;
      month: string; // "2026-11"
      amount: number;
      status?: PaymentStatus; // yuborilmasa PAID
      paidAt?: string;
      extra?: any;
    },
  ) {
    return this.paymentService.setStudentPayment(dto);
  }

  // Oy boshida hamma studentga PENDING qator yaratish
  @Post('monthly')
  @Roles(Role.ADMIN)
  createMonthlyPayments(
    @Body() dto: { groupId: string; month: string; amount: number },
  ) {
    return this.paymentService.createMonthlyPayments(dto.groupId, dto.month, dto.amount);
  }

  // Guruhning oylik summasini saqlash (shu oydan boshlab amal qiladi)
  @Put('group/:groupId/fee')
  @Roles(Role.ADMIN, Role.TEACHER)
  setGroupFee(
    @Param('groupId') groupId: string,
    @Body() dto: { month: string; amount: number }, // month: "2026-11"
  ) {
    return this.paymentService.setGroupFee(groupId, dto.month, dto.amount);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      amount?: number;
      status?: PaymentStatus;
      paidAt?: string;
      extra?: any;
    },
  ) {
    return this.paymentService.update(id, dto);
  }

  // Guruh sahifasi: tanlangan oyda har bir student, uning to'lovi va guruh summasi
  @Get('group/:groupId/month')
  @Roles(Role.ADMIN, Role.TEACHER)
  findGroupMonth(
    @Param('groupId') groupId: string,
    @Query('month') month: string, // "2026-11"
  ) {
    return this.paymentService.findGroupMonth(groupId, month);
  }

  @Get('group/:groupId')
  @Roles(Role.ADMIN)
  findByGroup(
    @Param('groupId') groupId: string,
    @Query('month') month?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentService.findByGroup(groupId, month, status);
  }

  @Get('student/:studentId')
  @Roles(Role.ADMIN)
  findByStudent(
    @Param('studentId') studentId: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentService.findByStudent(studentId, limit ? parseInt(limit, 10) : 12);
  }

  @Get('stats/:groupId')
  @Roles(Role.ADMIN)
  getGroupStats(
    @Param('groupId') groupId: string,
    @Query('startMonth') startMonth?: string,
    @Query('endMonth') endMonth?: string,
  ) {
    return this.paymentService.getGroupStats(groupId, startMonth, endMonth);
  }
}
