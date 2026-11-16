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
import { CreateMediaDto } from './dto/create-media.dto';
import { CreateQuestionDto, CreateQuestionsBulkDto } from './dto/create-questions.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionService } from './question.service';

@ApiTags('Question')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
@Controller('question')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
export class QuestionController {
  constructor(private readonly questions: QuestionService) {}

  @Post()
  @ApiOperation({
    summary: 'Bitta savol qo\'shish',
    description: 'Faqat ADMIN yoki TEACHER.',
  })
  @ApiCreatedResponse({ description: 'Savol qo\'shildi' })
  @ApiNotFoundResponse({ description: 'Qism (part) topilmadi' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateQuestionDto) {
    return this.questions.create(user, dto);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Ko\'p savolni birdan qo\'shish',
    description: 'DIQQAT: \':id\' yo\'llaridan oldin turishi shart.',
  })
  @ApiCreatedResponse({ description: 'Savollar qo\'shildi' })
  @ApiNotFoundResponse({ description: 'Qism (part) topilmadi' })
  createBulk(@CurrentUser() user: AuthUser, @Body() dto: CreateQuestionsBulkDto) {
    return this.questions.createBulk(user, dto);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Savollar tartibini o\'zgartirish' })
  @ApiOkResponse({ description: 'Tartib yangilandi' })
  @ApiNotFoundResponse({ description: 'Savol topilmadi' })
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderQuestionsDto) {
    return this.questions.reorder(user, dto);
  }

  @Delete('media/:mediaId')
  @ApiOperation({ summary: 'Savoldan rasm / audioni o\'chirish' })
  @ApiParam({ name: 'mediaId', format: 'uuid', description: 'Media ID' })
  @ApiOkResponse({ description: 'Media o\'chirildi' })
  @ApiNotFoundResponse({ description: 'Media topilmadi' })
  removeMedia(@CurrentUser() user: AuthUser, @Param('mediaId', ParseUUIDPipe) mediaId: string) {
    return this.questions.removeMedia(user, mediaId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta savolni olish' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Savol ID' })
  @ApiOkResponse({ description: 'Savol ma\'lumotlari' })
  @ApiNotFoundResponse({ description: 'Savol topilmadi' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Savolni tahrirlash' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Savol ID' })
  @ApiOkResponse({ description: 'Yangilangan savol' })
  @ApiNotFoundResponse({ description: 'Savol topilmadi' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questions.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Savolni o\'chirish' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Savol ID' })
  @ApiOkResponse({ description: 'Savol o\'chirildi' })
  @ApiNotFoundResponse({ description: 'Savol topilmadi' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.remove(user, id);
  }

  @Post(':id/media')
  @ApiOperation({
    summary: 'Savolga rasm / audio biriktirish',
    description: 'Savolga media fayl biriktiradi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Savol ID' })
  @ApiCreatedResponse({ description: 'Media biriktirildi' })
  @ApiNotFoundResponse({ description: 'Savol topilmadi' })
  addMedia(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMediaDto,
  ) {
    return this.questions.addMedia(user, id, dto);
  }
}
