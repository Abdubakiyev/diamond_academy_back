import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdvertisementService } from './advertisement.service';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/core/Guard/JwtGuard';
import { RolesGuard } from 'src/core/Guard/roles.guard';
import { Roles } from 'src/core/Guard/roles.decorator';
import { Role } from '@prisma/client';
import { fileUploadConfig } from 'src/common/utils/file-upload.config';

@ApiTags('Advertisements')
@Controller('advertisements')
export class AdvertisementController {
  constructor(private readonly advertisementService: AdvertisementService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', fileUploadConfig))
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Yangi reklama qo'shish" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Rasm yoki video fayl',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Reklama yaratildi.' })
  create(
    @Body() dto: CreateAdvertisementDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('Fayl yuklanishi shart!');
    }

    const adminId = req.user.id;
    const fileUrl = `/uploads/advertisements/${file.filename}`;

    // ✅ Transform decorator allaqachon handle qiladi
    return this.advertisementService.create(dto, fileUrl, adminId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Barcha reklamalarni olish (faqat admin)' })
  @ApiResponse({ status: 200, description: "Reklamalar ro'yxati." })
  findAll() {
    return this.advertisementService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Faol reklama (register panel uchun)' })
  @ApiResponse({ status: 200, description: 'Faol reklama.' })
  findActive() {
    return this.advertisementService.findActive();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: "ID bo'yicha reklama olish" })
  @ApiParam({ name: 'id', description: 'Advertisement ID' })
  findOne(@Param('id') id: string) {
    return this.advertisementService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', fileUploadConfig))
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reklamani o'zgartirish" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Yangi rasm yoki video (ixtiyoriy)',
        },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'Advertisement ID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdvertisementDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const fileUrl = file ? `/uploads/advertisements/${file.filename}` : undefined;

    // ✅ Transform decorator allaqachon handle qiladi
    return this.advertisementService.update(id, dto, fileUrl);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reklamani o'chirish" })
  @ApiParam({ name: 'id', description: 'Advertisement ID' })
  remove(@Param('id') id: string) {
    return this.advertisementService.remove(id);
  }
}