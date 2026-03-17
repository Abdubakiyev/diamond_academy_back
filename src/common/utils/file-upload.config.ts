// src/common/utils/file-upload.config.ts
import { diskStorage } from 'multer';
import { extname } from 'path';

export const fileUploadConfig = {
  storage: diskStorage({
    destination: './uploads/advertisements', // Fayl saqlanadigan papka
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      callback(null, `ad-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    // Faqat rasm va video
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/ogg',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Faqat rasm va video fayllar qabul qilinadi!'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
};