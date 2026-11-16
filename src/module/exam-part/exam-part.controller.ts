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
import { CreatePartDto } from './dto/create-part.dto';
import { ReorderPartsDto } from './dto/reorder-parts.dto';
import { SetPartOptionsDto } from './dto/set-part-options.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { ExamPartService } from './exam-part.service';

@ApiTags('Exam Part')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
@Controller('exam-part')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
export class ExamPartController {
  constructor(private readonly parts: ExamPartService) {}

  @Post()
  @ApiOperation({
    summary: 'Qism (part) yaratish',
    description: 'Imtihon bo\'limiga yangi qism qo\'shadi. Faqat ADMIN yoki TEACHER.',
  })
  @ApiCreatedResponse({ description: 'Qism yaratildi' })
  @ApiNotFoundResponse({ description: 'Bo\'lim topilmadi' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePartDto) {
    return this.parts.create(user, dto);
  }

  @Put('reorder')
  @ApiOperation({
    summary: 'Qismlar tartibini o\'zgartirish',
    description: 'DIQQAT: \':id\' yo\'llaridan oldin turishi shart.',
  })
  @ApiOkResponse({ description: 'Tartib yangilandi' })
  @ApiNotFoundResponse({ description: 'Qism topilmadi' })
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderPartsDto) {
    return this.parts.reorder(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta qismni olish' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Qism ID' })
  @ApiOkResponse({ description: 'Qism ma\'lumotlari' })
  @ApiNotFoundResponse({ description: 'Qism topilmadi' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parts.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Qismni tahrirlash' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Qism ID' })
  @ApiOkResponse({ description: 'Yangilangan qism' })
  @ApiNotFoundResponse({ description: 'Qism topilmadi' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartDto,
  ) {
    return this.parts.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Qismni o\'chirish' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Qism ID' })
  @ApiOkResponse({ description: 'Qism o\'chirildi' })
  @ApiNotFoundResponse({ description: 'Qism topilmadi' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parts.remove(user, id);
  }

  @Put(':id/options')
  @ApiOperation({
    summary: 'Umumiy variantlar bankini o\'rnatish',
    description: 'Umumiy variantlar bankini (A-H) o\'rnatadi yoki yangilaydi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Qism ID' })
  @ApiOkResponse({ description: 'Variantlar banki yangilandi' })
  @ApiNotFoundResponse({ description: 'Qism topilmadi' })
  setOptions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPartOptionsDto,
  ) {
    return this.parts.setOptions(user, id, dto);
  }
}
