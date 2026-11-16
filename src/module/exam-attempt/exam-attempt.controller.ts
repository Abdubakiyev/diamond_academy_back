import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
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
import { AttemptResultService } from './attempt-result.service';
import { ListAttemptsQueryDto } from './dto/list-attempts-query.dto';
import { PlayAudioDto } from './dto/play-audio.dto';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { ExamAttemptService } from './exam-attempt.service';

@ApiTags('Exam Attempt')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@Controller('exam-attempt')
@UseGuards(JwtGuard)
export class ExamAttemptController {
  constructor(
    private readonly attempts: ExamAttemptService,
    private readonly results: AttemptResultService,
  ) {}

  @Post('start')
  @ApiOperation({
    summary: 'Imtihonni boshlash',
    description: 'Imtihonni boshlaydi yoki tugallanmagan urinishni davom ettiradi.',
  })
  @ApiCreatedResponse({ description: 'Urinish boshlandi (yoki davom ettirildi)' })
  @ApiBadRequestResponse({ description: 'Imtihonni boshlab bo\'lmaydi' })
  @ApiNotFoundResponse({ description: 'Imtihon topilmadi' })
  start(@CurrentUser() user: AuthUser, @Body() dto: StartAttemptDto) {
    return this.attempts.start(user, dto);
  }

  @Get('my')
  @ApiOperation({
    summary: 'Mening urinishlarim',
    description: 'DIQQAT: \':id\' dan oldin turishi shart.',
  })
  @ApiOkResponse({ description: 'Joriy foydalanuvchining urinishlari ro\'yxati' })
  my(@CurrentUser() user: AuthUser, @Query() q: ListAttemptsQueryDto) {
    return this.results.listMine(user, q);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Barcha urinishlar ro\'yxati',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiOkResponse({ description: 'Urinishlar ro\'yxati' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  list(@CurrentUser() user: AuthUser, @Query() q: ListAttemptsQueryDto) {
    return this.results.listAll(user, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Urinish umumiy ko\'rinishi' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Urinish ID' })
  @ApiOkResponse({ description: 'Urinish va uning bo\'limlari holati' })
  @ApiForbiddenResponse({ description: 'Bu urinishni ko\'rishga ruxsat yo\'q' })
  @ApiNotFoundResponse({ description: 'Urinish topilmadi' })
  overview(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attempts.overview(user, id);
  }

  @Get(':id/result')
  @ApiOperation({ summary: 'Urinish natijasi' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Urinish ID' })
  @ApiOkResponse({ description: 'Urinish natijasi' })
  @ApiForbiddenResponse({ description: 'Bu natijani ko\'rishga ruxsat yo\'q' })
  @ApiNotFoundResponse({ description: 'Urinish topilmadi' })
  result(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.results.getResult(user, id);
  }

  @Post(':id/sections/:sectionId/start')
  @ApiOperation({
    summary: 'Bo\'limni boshlash',
    description: 'Urinish ichidagi tanlangan bo\'limni boshlaydi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Urinish ID' })
  @ApiParam({ name: 'sectionId', format: 'uuid', description: 'Bo\'lim ID' })
  @ApiCreatedResponse({ description: 'Bo\'lim boshlandi' })
  @ApiBadRequestResponse({ description: 'Bo\'limni boshlab bo\'lmaydi' })
  @ApiNotFoundResponse({ description: 'Urinish yoki bo\'lim topilmadi' })
  startSection(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.attempts.startSection(user, id, sectionId);
  }

  @Get(':id/sections/:sectionId/content')
  @ApiOperation({
    summary: 'Bo\'lim kontentini olish',
    description: 'Bo\'limdagi savollar va materiallarni qaytaradi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Urinish ID' })
  @ApiParam({ name: 'sectionId', format: 'uuid', description: 'Bo\'lim ID' })
  @ApiOkResponse({ description: 'Bo\'lim kontenti' })
  @ApiForbiddenResponse({ description: 'Bu kontentni ko\'rishga ruxsat yo\'q' })
  @ApiNotFoundResponse({ description: 'Urinish yoki bo\'lim topilmadi' })
  content(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.attempts.getSectionContent(user, id, sectionId);
  }

  @Put(':id/sections/:sectionId/answers')
  @ApiOperation({
    summary: 'Javoblarni saqlash (avto-saqlash)',
    description: 'Faqat o\'zgargan javoblarni yuboring. Bo\'sh qiymat javobni o\'chiradi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Urinish ID' })
  @ApiParam({ name: 'sectionId', format: 'uuid', description: 'Bo\'lim ID' })
  @ApiOkResponse({ description: 'Javoblar saqlandi' })
  @ApiBadRequestResponse({ description: 'Bo\'lim faol emas yoki vaqti tugagan' })
  @ApiNotFoundResponse({ description: 'Urinish yoki bo\'lim topilmadi' })
  saveAnswers(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: SaveAnswersDto,
  ) {
    return this.attempts.saveAnswers(user, id, sectionId, dto);
  }

  @Post(':id/sections/:sectionId/submit')
  @ApiOperation({
    summary: 'Bo\'limni topshirish',
    description: 'Bo\'limni yakunlaydi va javoblarni topshiradi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Urinish ID' })
  @ApiParam({ name: 'sectionId', format: 'uuid', description: 'Bo\'lim ID' })
  @ApiCreatedResponse({ description: 'Bo\'lim topshirildi' })
  @ApiBadRequestResponse({ description: 'Bo\'limni topshirib bo\'lmaydi' })
  @ApiNotFoundResponse({ description: 'Urinish yoki bo\'lim topilmadi' })
  submitSection(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.attempts.submitSection(user, id, sectionId);
  }

  @Post(':id/audio')
  @ApiOperation({
    summary: 'Listening audiosi uchun havola',
    description: 'Audio uchun vaqtinchalik havola qaytaradi. Ijro limiti hisoblanadi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Urinish ID' })
  @ApiCreatedResponse({ description: 'Audio uchun vaqtinchalik havola' })
  @ApiBadRequestResponse({ description: 'Audio ijro limiti tugagan' })
  @ApiNotFoundResponse({ description: 'Urinish yoki audio topilmadi' })
  audio(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlayAudioDto) {
    return this.attempts.playAudio(user, id, dto);
  }

  @Post(':id/finish')
  @ApiOperation({
    summary: 'Urinishni yakunlash',
    description: 'Butun imtihon urinishini yakunlaydi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Urinish ID' })
  @ApiCreatedResponse({ description: 'Urinish yakunlandi' })
  @ApiBadRequestResponse({ description: 'Urinishni yakunlab bo\'lmaydi' })
  @ApiNotFoundResponse({ description: 'Urinish topilmadi' })
  finish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attempts.finish(user, id);
  }
}
