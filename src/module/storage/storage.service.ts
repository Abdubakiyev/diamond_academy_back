import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { AuthUser } from '../../common/current-user.decorator';
import { PresignDto, UploadPurpose } from './dto/presign.dto';

const MB = 1024 * 1024;
const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AUDIO = [
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
];
const VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const DOCS = ['application/pdf', ...IMAGES];

type Rule = { folder: string; staffOnly: boolean; types: string[]; maxBytes: number };

/** Qaysi maqsad uchun: papka, kim yuklay oladi, ruxsat etilgan turlar va maksimal hajm */
const RULES: Record<UploadPurpose, Rule> = {
  [UploadPurpose.LESSON_VIDEO]: { folder: 'lessons/video', staffOnly: true, types: VIDEO, maxBytes: 1024 * MB },
  [UploadPurpose.LESSON_RESOURCE]: { folder: 'lessons/resources', staffOnly: true, types: DOCS, maxBytes: 50 * MB },
  [UploadPurpose.EXAM_AUDIO]: { folder: 'exams/audio', staffOnly: true, types: AUDIO, maxBytes: 100 * MB },
  [UploadPurpose.EXAM_IMAGE]: { folder: 'exams/images', staffOnly: true, types: IMAGES, maxBytes: 10 * MB },
  [UploadPurpose.SUBMISSION_FILE]: { folder: 'submissions', staffOnly: false, types: DOCS, maxBytes: 15 * MB },
  [UploadPurpose.SPEAKING_AUDIO]: { folder: 'speaking', staffOnly: false, types: AUDIO, maxBytes: 50 * MB },
};

export type PresignResult = {
  /** Frontend shu manzilga PUT so'rovi bilan faylni yuboradi */
  uploadUrl: string;
  /** PUT so'rovida AYNAN shu sarlavhalar yuborilishi shart */
  headers: Record<string, string>;
  /** Bazaga saqlanadigan kalit (videoKey, audioKey, storageKey ...) */
  key: string;
  /** Ochiq o'qish manzili (S3_PUBLIC_URL berilgan bo'lsa), aks holda null */
  publicUrl: string | null;
  expiresIn: number;
};

const URL_TTL_SECONDS = 10 * 60;

/**
 * Fayllar serverga emas, to'g'ridan-to'g'ri S3-mos storage'ga (Cloudflare R2, AWS S3, MinIO) yuklanadi.
 * Backend faqat qisqa muddatli imzolangan URL beradi, shuning uchun serverga yuk tushmaydi.
 */
@Injectable()
export class StorageService {
  private client?: S3Client;

  private getClient(): S3Client {
    if (this.client) return this.client;

    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!process.env.S3_BUCKET || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException(
        'Fayl saqlash sozlanmagan (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)',
      );
    }

    this.client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint,
      credentials: { accessKeyId, secretAccessKey },
      // Yangi SDK versiyalari presigned URL ga checksum qo'shadi va R2 buni qabul qilmaydi
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    return this.client;
  }

  private get bucket() {
    return process.env.S3_BUCKET as string;
  }

  /** Foydalanuvchi uchun yuklash URL i yaratadi */
  async presign(user: AuthUser, dto: PresignDto): Promise<PresignResult> {
    const rule = RULES[dto.purpose];

    if (rule.staffOnly && user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
      throw new ForbiddenException('Bu turdagi faylni faqat admin yoki o‘qituvchi yuklay oladi');
    }

    // "audio/webm;codecs=opus" -> "audio/webm"
    const contentType = dto.contentType.split(';')[0].trim().toLowerCase();
    if (!rule.types.includes(contentType)) {
      throw new BadRequestException(`Bu fayl turi ruxsat etilmagan: ${contentType}`);
    }
    if (dto.sizeBytes > rule.maxBytes) {
      throw new BadRequestException(
        `Fayl juda katta. Maksimal hajm: ${Math.round(rule.maxBytes / MB)} MB`,
      );
    }

    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const key = `${rule.folder}/${now.getUTCFullYear()}-${month}/${randomUUID()}${this.safeExt(dto.fileName)}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: dto.sizeBytes,
    });
    const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn: URL_TTL_SECONDS });

    return {
      uploadUrl,
      headers: { 'Content-Type': contentType },
      key,
      publicUrl: this.publicUrl(key),
      expiresIn: URL_TTL_SECONDS,
    };
  }

  /** Ochiq (public) manzil. S3_PUBLIC_URL berilmagan bo'lsa null. */
  publicUrl(key: string): string | null {
    const base = process.env.S3_PUBLIC_URL;
    return base ? `${base.replace(/\/+$/, '')}/${key}` : null;
  }

  /** Yopiq fayl uchun vaqtinchalik o'qish URL i (masalan AI ovozni yuklab olishi uchun) */
  async getReadUrl(key: string, expiresIn = 15 * 60): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.getClient(), command, { expiresIn });
  }

  /** Storage'dan faylni o'chiradi (xato bo'lsa ham asosiy jarayonni to'xtatmaydi) */
  async remove(key?: string | null): Promise<void> {
    if (!key) return;
    try {
      await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      /* e'tiborsiz: o'chmagan fayl keyin qo'lda tozalanadi */
    }
  }

  private safeExt(fileName: string): string {
    const ext = extname(fileName).toLowerCase();
    return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
  }
}
