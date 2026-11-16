import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/current-user.decorator';
import { JwtGuard, Roles, RolesGuard } from '../../common/guards';
import { CheckoutDto } from './dto/checkout.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { ManualPaymentDto } from './dto/manual-payment.dto';
import { PaymentNoteDto } from './dto/payment-note.dto';
import { ExamAccessService } from './exam-access.service';
import { ExamPaymentService } from './exam-payment.service';

@ApiTags('Exam Payment')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@Controller('exam-payment')
@UseGuards(JwtGuard)
export class ExamPaymentController {
  constructor(
    private readonly payments: ExamPaymentService,
    private readonly access: ExamAccessService,
  ) {}

  /* ── Foydalanuvchi ── */

  @Get('access/:examId')
  @ApiOperation({
    summary: 'Testga kirish holati',
    description: 'Test bepulmi, to\'lov kerakmi va boshlash mumkinmi, shuni qaytaradi.',
  })
  @ApiParam({ name: 'examId', format: 'uuid', description: 'Imtihon ID' })
  @ApiOkResponse({ description: 'Kirish holati haqida ma\'lumot' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  getAccess(@CurrentUser() user: AuthUser, @Param('examId', ParseUUIDPipe) examId: string) {
    return this.access.getAccessInfo(user, examId);
  }

  @Post('checkout')
  @ApiOperation({
    summary: 'To\'lovni boshlash',
    description: 'Click / Payme / Uzum orqali to\'lov jarayonini boshlaydi.',
  })
  @ApiCreatedResponse({ description: 'To\'lov yaratildi (to\'lov havolasi qaytariladi)' })
  @ApiBadRequestResponse({ description: 'To\'lov boshlab bo\'lmaydi (masalan, test bepul yoki allaqachon sotib olingan)' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.payments.checkout(user, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Mening to\'lovlarim' })
  @ApiOkResponse({ description: 'Joriy foydalanuvchining to\'lovlari ro\'yxati' })
  listMine(@CurrentUser() user: AuthUser) {
    return this.payments.listMine(user);
  }

  /* ── Admin ── */

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Barcha to\'lovlar ro\'yxati',
    description: 'Filtr va sahifalash bilan. Faqat ADMIN.',
  })
  @ApiOkResponse({ description: 'To\'lovlar ro\'yxati' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN)' })
  list(@Query() query: ListPaymentsQueryDto) {
    return this.payments.list(query);
  }

  @Post('manual')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'To\'lovni qo\'lda kiritish',
    description: 'Naqd yoki o\'tkazma orqali qilingan to\'lovni qo\'lda kiritadi. Faqat ADMIN.',
  })
  @ApiCreatedResponse({ description: 'To\'lov qo\'lda kiritildi' })
  @ApiBadRequestResponse({ description: 'Noto\'g\'ri so\'rov ma\'lumotlari' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN)' })
  @ApiNotFoundResponse({ description: 'Foydalanuvchi yoki imtihon topilmadi' })
  createManual(@CurrentUser() admin: AuthUser, @Body() dto: ManualPaymentDto) {
    return this.payments.createManual(admin, dto);
  }

  @Post(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'To\'lovni tasdiqlash',
    description: 'Faqat ADMIN.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'To\'lov ID' })
  @ApiCreatedResponse({ description: 'To\'lov tasdiqlandi' })
  @ApiBadRequestResponse({ description: 'To\'lov holati tasdiqlashga mos emas' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN)' })
  @ApiNotFoundResponse({ description: 'To\'lov topilmadi' })
  confirm(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentNoteDto,
  ) {
    return this.payments.confirm(admin, id, dto.note);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'To\'lovni bekor qilish',
    description: 'Faqat ADMIN.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'To\'lov ID' })
  @ApiCreatedResponse({ description: 'To\'lov bekor qilindi' })
  @ApiBadRequestResponse({ description: 'To\'lov holati bekor qilishga mos emas' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN)' })
  @ApiNotFoundResponse({ description: 'To\'lov topilmadi' })
  cancel(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentNoteDto,
  ) {
    return this.payments.cancel(admin, id, dto.note);
  }

  @Post(':id/refund')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'To\'lovni qaytarish (refund)',
    description: 'Faqat ADMIN.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'To\'lov ID' })
  @ApiCreatedResponse({ description: 'To\'lov qaytarildi' })
  @ApiBadRequestResponse({ description: 'To\'lov holati qaytarishga mos emas' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN)' })
  @ApiNotFoundResponse({ description: 'To\'lov topilmadi' })
  refund(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentNoteDto,
  ) {
    return this.payments.refund(admin, id, dto.note);
  }
}
