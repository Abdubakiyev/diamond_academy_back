import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
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
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { ListExamsQueryDto } from './dto/list-exams-query.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { ExamService } from './exam.service';

@ApiTags('Exam')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@Controller('exam')
@UseGuards(JwtGuard)
export class ExamController {
  constructor(private readonly exams: ExamService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Imtihon yaratish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiCreatedResponse({ description: 'Imtihon yaratildi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExamDto) {
    return this.exams.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Imtihonlar ro\'yxati',
    description:
      'ADMIN / TEACHER o\'zining barcha imtihonlarini ko\'radi, qolganlar faqat e\'lon qilinganlarini.',
  })
  @ApiOkResponse({ description: 'Imtihonlar ro\'yxati' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListExamsQueryDto) {
    return this.exams.findAll(user, query);
  }

  @Patch('sections/:sectionId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Bo\'limni tahrirlash',
    description: 'DIQQAT: \':id\' yo\'llaridan oldin turishi shart. Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'sectionId', format: 'uuid', description: 'Bo\'lim ID' })
  @ApiOkResponse({ description: 'Yangilangan bo\'lim' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Bo\'lim topilmadi' })
  updateSection(
    @CurrentUser() user: AuthUser,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.exams.updateSection(user, sectionId, dto);
  }

  @Delete('sections/:sectionId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Bo\'limni o\'chirish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'sectionId', format: 'uuid', description: 'Bo\'lim ID' })
  @ApiOkResponse({ description: 'Bo\'lim o\'chirildi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Bo\'lim topilmadi' })
  removeSection(
    @CurrentUser() user: AuthUser,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.exams.removeSection(user, sectionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta imtihonni olish' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Imtihon ID' })
  @ApiOkResponse({ description: 'Imtihon ma\'lumotlari' })
  @ApiForbiddenResponse({ description: 'Bu imtihonni ko\'rishga ruxsat yo\'q' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.findOne(user, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Imtihonni tahrirlash',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Imtihon ID' })
  @ApiOkResponse({ description: 'Yangilangan imtihon' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.exams.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Imtihonni o\'chirish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Imtihon ID' })
  @ApiOkResponse({ description: 'Imtihon o\'chirildi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.remove(user, id);
  }

  @Post(':id/sections')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Imtihonga bo\'lim qo\'shish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Imtihon ID' })
  @ApiCreatedResponse({ description: 'Bo\'lim qo\'shildi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  addSection(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.exams.addSection(user, id, dto);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Imtihonni e\'lon qilish',
    description: 'Imtihonni o\'quvchilarga ko\'rinadigan qiladi. Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Imtihon ID' })
  @ApiCreatedResponse({ description: 'Imtihon e\'lon qilindi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.publish(user, id);
  }

  @Post(':id/unpublish')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Imtihonni e\'londan olish',
    description: 'Imtihonni o\'quvchilardan yashiradi. Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Imtihon ID' })
  @ApiCreatedResponse({ description: 'Imtihon e\'londan olindi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  unpublish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.unpublish(user, id);
  }

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Imtihonni arxivlash',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Imtihon ID' })
  @ApiCreatedResponse({ description: 'Imtihon arxivlandi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.archive(user, id);
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Imtihonni arxivdan qaytarish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Imtihon ID' })
  @ApiCreatedResponse({ description: 'Imtihon arxivdan qaytarildi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  restore(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.restore(user, id);
  }
}
