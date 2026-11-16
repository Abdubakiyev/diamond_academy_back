import { Body, Controller, Delete, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/current-user.decorator';
import { JwtGuard, Roles, RolesGuard } from '../../common/guards';
import { ConversionQueryDto } from './dto/conversion-query.dto';
import { GenerateConversionDto } from './dto/generate-conversion.dto';
import { SetConversionDto } from './dto/set-conversion.dto';
import { ScoreConversionService } from './score-conversion.service';

@ApiTags('Score Conversion')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
@Controller('score-conversion')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
export class ScoreConversionController {
  constructor(private readonly conversions: ScoreConversionService) {}

  @Get()
  @ApiOperation({
    summary: 'O\'tkazish jadvalini olish',
    description: 'Raw ball -> 0-75 o\'tkazish jadvali. `examId` berilmasa, umumiy (default) jadval qaytariladi.',
  })
  @ApiOkResponse({ description: 'O\'tkazish jadvali' })
  list(@Query() query: ConversionQueryDto) {
    return this.conversions.list(query);
  }

  @Put()
  @ApiOperation({
    summary: 'Jadvalni to\'liq almashtirish',
    description: 'Umumiy (default) jadvalni faqat ADMIN o\'zgartira oladi.',
  })
  @ApiOkResponse({ description: 'Jadval yangilandi' })
  @ApiBadRequestResponse({ description: 'Jadval ma\'lumotlari noto\'g\'ri' })
  set(@CurrentUser() user: AuthUser, @Body() dto: SetConversionDto) {
    return this.conversions.setTable(user, dto);
  }

  @Post('generate-linear')
  @ApiOperation({
    summary: 'Chiziqli jadval yaratish',
    description: 'Formula: raw / maxRaw * 75. Umumiy jadvalni faqat ADMIN o\'zgartira oladi.',
  })
  @ApiCreatedResponse({ description: 'Chiziqli jadval yaratildi' })
  @ApiBadRequestResponse({ description: 'Noto\'g\'ri so\'rov ma\'lumotlari' })
  generateLinear(@CurrentUser() user: AuthUser, @Body() dto: GenerateConversionDto) {
    return this.conversions.generateLinear(user, dto);
  }

  @Delete()
  @ApiOperation({
    summary: 'Jadvalni o\'chirish',
    description: 'O\'chirilgandan keyin umumiy jadval yoki chiziqli hisob ishlatiladi. Umumiy jadvalni faqat ADMIN o\'chira oladi.',
  })
  @ApiOkResponse({ description: 'Jadval o\'chirildi' })
  remove(@CurrentUser() user: AuthUser, @Query() query: ConversionQueryDto) {
    return this.conversions.remove(user, query);
  }
}
