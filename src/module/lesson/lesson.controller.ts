import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonService } from './lesson.service';

@ApiTags('Lesson')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@Controller('lesson')
@UseGuards(JwtGuard)
export class LessonController {
  constructor(private readonly lessons: LessonService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Dars yaratish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiCreatedResponse({ description: 'Dars yaratildi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Kurs topilmadi' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLessonDto) {
    return this.lessons.create(user, dto);
  }

  @Put('reorder')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Kursdagi darslar tartibini almashtirish',
    description: 'DIQQAT: \':id\' yo\'llaridan oldin turishi shart. Faqat ADMIN yoki TEACHER.',
  })
  @ApiOkResponse({ description: 'Darslar tartibi yangilandi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Kurs yoki dars topilmadi' })
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderLessonsDto) {
    return this.lessons.reorder(user, dto);
  }

  @Delete('resources/:resourceId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Materialni o\'chirish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'resourceId', format: 'uuid', description: 'Material ID' })
  @ApiOkResponse({ description: 'Material o\'chirildi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Material topilmadi' })
  removeResource(
    @CurrentUser() user: AuthUser,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ) {
    return this.lessons.removeResource(user, resourceId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Darsni ko\'rish',
    description: 'Video, materiallar, vazifalar, oldingi va keyingi dars ma\'lumotlarini qaytaradi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Dars ID' })
  @ApiOkResponse({ description: 'Dars ma\'lumotlari' })
  @ApiForbiddenResponse({ description: 'Bu darsni ko\'rishga ruxsat yo\'q' })
  @ApiNotFoundResponse({ description: 'Dars topilmadi' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.findOne(user, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Darsni tahrirlash',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Dars ID' })
  @ApiOkResponse({ description: 'Yangilangan dars' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Dars topilmadi' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessons.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Darsni o\'chirish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Dars ID' })
  @ApiOkResponse({ description: 'Dars o\'chirildi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Dars topilmadi' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.remove(user, id);
  }

  @Post(':id/resources')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Darsga material qo\'shish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Dars ID' })
  @ApiCreatedResponse({ description: 'Material qo\'shildi' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Dars topilmadi' })
  addResource(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateResourceDto,
  ) {
    return this.lessons.addResource(user, id, dto);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Darsni "tugatdim" deb belgilash',
    description: 'Joriy foydalanuvchi uchun darsni tugatilgan deb belgilaydi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Dars ID' })
  @ApiCreatedResponse({ description: 'Dars tugatilgan deb belgilandi' })
  @ApiForbiddenResponse({ description: 'Bu darsga ruxsat yo\'q' })
  @ApiNotFoundResponse({ description: 'Dars topilmadi' })
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.setProgress(user, id, true);
  }

  @Delete(':id/complete')
  @ApiOperation({
    summary: '"Tugatdim" belgisini qaytarish',
    description: 'Joriy foydalanuvchi uchun darsning tugatilgan belgisini olib tashlaydi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Dars ID' })
  @ApiOkResponse({ description: 'Belgi olib tashlandi' })
  @ApiForbiddenResponse({ description: 'Bu darsga ruxsat yo\'q' })
  @ApiNotFoundResponse({ description: 'Dars topilmadi' })
  uncomplete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.setProgress(user, id, false);
  }
}
