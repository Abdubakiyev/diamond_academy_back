// src/common/utils/file-upload.config.ts
import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';

/**
 * Ruxsat etilgan MIME turlari va ularga mos XAVFSIZ kengaytmalar.
 * Kengaytma foydalanuvchi yuborgan fayl nomidan EMAS, shu jadvaldan olinadi.
 * (Aks holda "xss.html" nomli faylni "image/png" deb yuborib, saytingiz
 * domenidan HTML/JS fayl tarqatish mumkin bo'lardi.)
 */
const ALLOWED_TYPES = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/ogg', '.ogg'],
]);

export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

/** Istalgan papka uchun upload sozlamasi: createFileUploadConfig('avatars', 'avatar') */
export const createFileUploadConfig = (
  folder: string,
  prefix = 'file',
): MulterOptions => ({
  storage: diskStorage({
    destination: `./uploads/${folder}`, // papka yo'q bo'lsa multer o'zi yaratadi
    filename: (_req, file, callback) => {
      const ext = ALLOWED_TYPES.get(file.mimetype) ?? '';
      callback(null, `${prefix}-${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      callback(null, true);
    } else {
      // BadRequestException => 400 qaytadi (oddiy Error bo'lsa, 500 qaytardi)
      callback(
        new BadRequestException(
          'Faqat rasm (JPG, PNG, GIF, WEBP) va video (MP4, WEBM, OGG) fayllar qabul qilinadi!',
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: 1,
  },
});

// Reklamalar uchun (avvalgi nom bilan ishlayveradi)
export const fileUploadConfig = createFileUploadConfig('advertisements', 'ad');
