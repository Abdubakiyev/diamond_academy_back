import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtGuard, Roles, RolesGuard } from '../../common/guards';
import { CenterStudentService } from './center-student.service';
import { BulkCenterStudentDto, CenterStudentQueryDto, SetCenterStudentDto } from './dto/center-student.dto';

@ApiTags('Center Student')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN)' })
@Controller('center-student')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CenterStudentController {
  constructor(private readonly centerStudents: CenterStudentService) {}

  @Get()
  @ApiOperation({
    summary: 'O\'quv markazi o\'quvchilari ro\'yxati',
    description: 'Kim o\'quv markazi o\'quvchisi ekanini (testlar bepul) ko\'rsatadi. Faqat ADMIN.',
  })
  @ApiOkResponse({ description: 'Foydalanuvchilar ro\'yxati' })
  list(@Query() query: CenterStudentQueryDto) {
    return this.centerStudents.list(query);
  }

  @Put('bulk')
  @ApiOperation({
    summary: 'Bir nechta foydalanuvchini birdan belgilash',
    description: 'DIQQAT: \':userId\' dan oldin turishi shart.',
  })
  @ApiOkResponse({ description: 'Foydalanuvchilar yangilandi' })
  @ApiBadRequestResponse({ description: 'Noto\'g\'ri so\'rov ma\'lumotlari' })
  bulk(@Body() dto: BulkCenterStudentDto) {
    return this.centerStudents.bulk(dto);
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'Foydalanuvchini o\'quv markazi o\'quvchisi sifatida belgilash',
    description: 'Bitta foydalanuvchi uchun `isCenterStudent` qiymatini o\'zgartiradi.',
  })
  @ApiParam({ name: 'userId', format: 'uuid', description: 'Foydalanuvchi ID' })
  @ApiOkResponse({ description: 'Foydalanuvchi yangilandi' })
  @ApiNotFoundResponse({ description: 'Foydalanuvchi topilmadi' })
  set(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: SetCenterStudentDto) {
    return this.centerStudents.set(userId, dto.isCenterStudent);
  }
}
