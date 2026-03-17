// src/advertisement/advertisement.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class AdvertisementService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAdvertisementDto, fileUrl: string, adminId: string) {
    // ✅ isActive ni boolean'ga convert qilish (multipart/form-data string qaytaradi)
    const isActive = dto.isActive === true || (dto.isActive as unknown as string) === 'true';

    // agar isActive true bo'lsa, eski reklama noaktiv qilamiz
    if (isActive) {
      await this.prisma.advertisement.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    return this.prisma.advertisement.create({
      data: {
        title: dto.title,
        description: dto.description,
        imageUrl: fileUrl,
        isActive: isActive,
        createdBy: adminId,
      },
    });
  }

  async findAll() {
    return this.prisma.advertisement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive() {
    return this.prisma.advertisement.findFirst({
      where: { isActive: true },
    });
  }

  async findOne(id: string) {
    const ad = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Advertisement not found');
    return ad;
  }

  async update(id: string, dto: UpdateAdvertisementDto, fileUrl?: string) {
    const existingAd = await this.findOne(id);

    // ✅ isActive ni boolean'ga convert qilish
    let isActive: boolean | undefined = undefined;
    if (dto.isActive !== undefined) {
      isActive = dto.isActive === true || (dto.isActive as unknown as string) === 'true';
    }

    // agar isActive true bo'lsa, boshqa reklama noaktiv qilinadi
    if (isActive === true) {
      await this.prisma.advertisement.updateMany({
        where: { isActive: true, NOT: { id } },
        data: { isActive: false },
      });
    }

    // Agar yangi fayl yuklangan bo'lsa, eski faylni o'chirish
    if (fileUrl && existingAd.imageUrl) {
      try {
        const oldFilePath = join(process.cwd(), existingAd.imageUrl);
        await unlink(oldFilePath);
      } catch (error) {
        console.error('Error deleting old file:', error);
      }
    }

    return this.prisma.advertisement.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(isActive !== undefined && { isActive: isActive }),
        ...(fileUrl && { imageUrl: fileUrl }),
      },
    });
  }

  async remove(id: string) {
    const ad = await this.findOne(id);

    // Faylni o'chirish
    if (ad.imageUrl) {
      try {
        const filePath = join(process.cwd(), ad.imageUrl);
        await unlink(filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    return this.prisma.advertisement.delete({ where: { id } });
  }
}