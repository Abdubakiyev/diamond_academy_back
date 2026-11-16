import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/current-user.decorator';
import { JwtGuard } from '../../common/guards';
import { PresignDto } from './dto/presign.dto';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@Controller('storage')
@UseGuards(JwtGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign')
  @ApiOperation({
    summary: 'Fayl yuklash uchun imzolangan URL olish',
    description: [
      'Fayl to\'g\'ridan-to\'g\'ri storage\'ga yuklanishi uchun vaqtinchalik imzolangan URL qaytaradi.',
      '',
      'Frontend uchun tartib:',
      '1. `POST /storage/presign` ga `{ purpose, fileName, contentType, sizeBytes }` yuboriladi.',
      '2. Javobdagi `uploadUrl` ga `PUT` so\'rov yuboriladi: body sifatida fayl, headers sifatida javobdagi `headers` (Content-Type).',
      '3. Javobdagi `key` / `publicUrl` keyingi so\'rovda (dars, vazifa, javob) yuboriladi.',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    description: 'Imzolangan URL yaratildi (`uploadUrl`, `headers`, `key`, `publicUrl`)',
  })
  @ApiBadRequestResponse({
    description: 'Noto\'g\'ri so\'rov (fayl turi ruxsat etilmagan yoki hajmi katta)',
  })
  @ApiForbiddenResponse({
    description: 'Bu maqsad (`purpose`) uchun yuklashga ruxsat yo\'q',
  })
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.storage.presign(user, dto);
  }
}
