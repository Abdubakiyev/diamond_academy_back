import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, VideoSource } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CourseService } from '../course/course.service';
import { StorageService } from '../storage/storage.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { extractYoutubeId, isHttpUrl, youtubeEmbedUrl, youtubeThumbnailUrl } from './youtube.util';

const VIDEO_KEY_PREFIX = 'lessons/video/';
const RESOURCE_KEY_PREFIX = 'lessons/resources/';
const READ_URL_TTL = 6 * 60 * 60; // yopiq fayllar uchun 6 soatlik o'qish havolasi

type VideoFields = {
  videoSource: VideoSource;
  videoUrl: string | null;
  videoKey: string | null;
};

@Injectable()
export class LessonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CourseService,
    private readonly storage: StorageService,
  ) {}

  private isStaff(role: Role) {
    return role === Role.ADMIN || role === Role.TEACHER;
  }

  /* ───────────── Yordamchilar ───────────── */

  private isUniqueViolation(e: unknown) {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
  }

  private async getLessonOrThrow(id: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    return lesson;
  }

  /** ADMIN hammasini, TEACHER faqat o'zi yaratgan kursdagi darslarni boshqaradi */
  private async assertCanManageCourse(user: AuthUser, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { createdById: true },
    });
    if (!course) throw new NotFoundException('Kurs topilmadi');
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.TEACHER && course.createdById === user.id) return;
    throw new ForbiddenException('Bu kursdagi darslarni boshqarish huquqingiz yo‘q');
  }

  /** Video manbasiga qarab maydonlarni tekshiradi va bir xil ko'rinishga keltiradi */
  private normalizeVideo(
    source: VideoSource,
    url?: string | null,
    key?: string | null,
  ): VideoFields {
    switch (source) {
      case VideoSource.NONE:
        return { videoSource: source, videoUrl: null, videoKey: null };

      case VideoSource.YOUTUBE: {
        if (!url) throw new BadRequestException('YouTube havolasini kiriting');
        const id = extractYoutubeId(url);
        if (!id) throw new BadRequestException('YouTube havolasi noto‘g‘ri');
        return { videoSource: source, videoUrl: youtubeEmbedUrl(id), videoKey: null };
      }

      case VideoSource.EXTERNAL: {
        if (!url || !isHttpUrl(url)) {
          throw new BadRequestException('Video havolasi noto‘g‘ri (http yoki https bo‘lishi kerak)');
        }
        return { videoSource: source, videoUrl: url.trim(), videoKey: null };
      }

      case VideoSource.UPLOAD: {
        if (!key || !key.startsWith(VIDEO_KEY_PREFIX)) {
          throw new BadRequestException(
            'Video fayl kaliti noto‘g‘ri. Avval POST /storage/presign (LESSON_VIDEO) orqali yuklang',
          );
        }
        return { videoSource: source, videoUrl: this.storage.publicUrl(key), videoKey: key };
      }

      default:
        throw new BadRequestException('Video manbasi noto‘g‘ri');
    }
  }

  /** Yopiq storage bo'lsa vaqtinchalik o'qish havolasi, ochiq bo'lsa saqlangan manzil */
  private async resolveFileUrl(url: string, storageKey: string | null): Promise<string> {
    if (!storageKey || this.storage.publicUrl(storageKey)) return url;
    try {
      return await this.storage.getReadUrl(storageKey, READ_URL_TTL);
    } catch {
      return url;
    }
  }

  /** Frontend pleyerga beradigan tayyor video ma'lumoti */
  private async buildVideo(lesson: {
    videoSource: VideoSource;
    videoUrl: string | null;
    videoKey: string | null;
    durationSec: number | null;
  }) {
    const { videoSource: source, videoUrl, videoKey } = lesson;

    let playbackUrl: string | null = null;
    let thumbnail: string | null = null;

    if (source === VideoSource.YOUTUBE || source === VideoSource.EXTERNAL) {
      playbackUrl = videoUrl;
      if (source === VideoSource.YOUTUBE && videoUrl) {
        const id = extractYoutubeId(videoUrl);
        thumbnail = id ? youtubeThumbnailUrl(id) : null;
      }
    } else if (source === VideoSource.UPLOAD && videoKey) {
      playbackUrl = this.storage.publicUrl(videoKey);
      if (!playbackUrl) {
        try {
          playbackUrl = await this.storage.getReadUrl(videoKey, READ_URL_TTL);
        } catch {
          playbackUrl = null;
        }
      }
    }

    return { source, playbackUrl, thumbnail, durationSec: lesson.durationSec };
  }

  /* ───────────── Darsni yaratish / o'zgartirish / o'chirish ───────────── */

  async create(user: AuthUser, dto: CreateLessonDto) {
    await this.assertCanManageCourse(user, dto.courseId);

    const video = this.normalizeVideo(dto.videoSource ?? VideoSource.NONE, dto.videoUrl, dto.videoKey);

    let order = dto.order;
    if (order === undefined) {
      const agg = await this.prisma.lesson.aggregate({
        where: { courseId: dto.courseId },
        _max: { order: true },
      });
      order = (agg._max.order ?? 0) + 1;
    }

    try {
      return await this.prisma.lesson.create({
        data: {
          courseId: dto.courseId,
          title: dto.title.trim(),
          description: dto.description,
          order,
          isPublished: dto.isPublished ?? false,
          durationSec: dto.durationSec,
          ...video,
        },
      });
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException('Bu tartib raqami kursda band. Boshqa raqam bering yoki bo‘sh qoldiring');
      }
      throw e;
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateLessonDto) {
    const lesson = await this.getLessonOrThrow(id);
    await this.assertCanManageCourse(user, lesson.courseId);

    // Video maydonlaridan biri yuborilgan bo'lsa, joriy qiymatlar bilan birlashtirib qayta tekshiramiz
    const videoTouched =
      dto.videoSource !== undefined || dto.videoUrl !== undefined || dto.videoKey !== undefined;

    const video = videoTouched
      ? this.normalizeVideo(
          dto.videoSource ?? lesson.videoSource,
          dto.videoUrl !== undefined ? dto.videoUrl : lesson.videoUrl,
          dto.videoKey !== undefined ? dto.videoKey : lesson.videoKey,
        )
      : undefined;

    let updated;
    try {
      updated = await this.prisma.lesson.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description: dto.description,
          order: dto.order,
          isPublished: dto.isPublished,
          durationSec: dto.durationSec,
          ...(video ?? {}),
        },
      });
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException('Bu tartib raqami kursda band. Tartibni o‘zgartirish uchun PUT /lesson/reorder dan foydalaning');
      }
      throw e;
    }

    // Eski video fayl almashtirilgan yoki olib tashlangan bo'lsa, storage'dan o'chiramiz
    if (video && lesson.videoKey && lesson.videoKey !== video.videoKey) {
      await this.storage.remove(lesson.videoKey);
    }

    return updated;
  }

  /** Diqqat: dars o'chsa, uning vazifalari va o'quvchi topshirgan ishlar ham o'chadi (Cascade) */
  async remove(user: AuthUser, id: string) {
    const lesson = await this.getLessonOrThrow(id);
    await this.assertCanManageCourse(user, lesson.courseId);

    // O'chirishdan oldin storage kalitlarini yig'ib olamiz
    const [resources, submissionFiles] = await Promise.all([
      this.prisma.lessonResource.findMany({ where: { lessonId: id }, select: { storageKey: true } }),
      this.prisma.submissionFile.findMany({
        where: { submission: { assignment: { lessonId: id } } },
        select: { storageKey: true },
      }),
    ]);

    await this.prisma.lesson.delete({ where: { id } });

    const keys = [
      lesson.videoKey,
      ...resources.map((r) => r.storageKey),
      ...submissionFiles.map((f) => f.storageKey),
    ].filter((k): k is string => !!k);
    await Promise.allSettled(keys.map((k) => this.storage.remove(k)));

    return { deleted: true };
  }

  /**
   * Kursdagi darslar tartibini almashtiradi.
   * (courseId, order) unique bo'lgani uchun avval vaqtinchalik manfiy raqamlar beriladi.
   */
  async reorder(user: AuthUser, dto: ReorderLessonsDto) {
    await this.assertCanManageCourse(user, dto.courseId);

    const existing = await this.prisma.lesson.findMany({
      where: { courseId: dto.courseId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((l) => l.id));
    const sameSet =
      existingIds.size === dto.lessonIds.length && dto.lessonIds.every((id) => existingIds.has(id));
    if (!sameSet) {
      throw new BadRequestException('lessonIds kursdagi barcha darslarni aynan bir martadan o‘z ichiga olishi kerak');
    }

    await this.prisma.$transaction([
      ...dto.lessonIds.map((id, i) =>
        this.prisma.lesson.update({ where: { id }, data: { order: -(i + 1) } }),
      ),
      ...dto.lessonIds.map((id, i) =>
        this.prisma.lesson.update({ where: { id }, data: { order: i + 1 } }),
      ),
    ]);

    return this.prisma.lesson.findMany({
      where: { courseId: dto.courseId },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, order: true, isPublished: true },
    });
  }

  /* ───────────── Darsni ko'rish ───────────── */

  async findOne(user: AuthUser, id: string) {
    const staff = this.isStaff(user.role);

    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        resources: { orderBy: { createdAt: 'asc' } },
        assignments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            maxScore: true,
            dueDate: true,
            allowText: true,
            allowFiles: true,
            // O'quvchi uchun: o'zining topshirgan ishi holati
            ...(staff
              ? {}
              : {
                  submissions: {
                    where: { userId: user.id },
                    select: { id: true, status: true, score: true, submittedAt: true },
                  },
                }),
          },
        },
        ...(staff
          ? {}
          : { progress: { where: { userId: user.id }, select: { completed: true, completedAt: true } } }),
      },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    if (!staff) {
      if (!lesson.isPublished) throw new NotFoundException('Dars topilmadi');
      await this.courses.assertCanView(user, lesson.courseId);
    }

    // Oldingi / keyingi dars
    const siblings = await this.prisma.lesson.findMany({
      where: { courseId: lesson.courseId, ...(staff ? {} : { isPublished: true }) },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, order: true },
    });
    const idx = siblings.findIndex((s) => s.id === lesson.id);

    const [video, resources] = await Promise.all([
      this.buildVideo(lesson),
      Promise.all(
        lesson.resources.map(async (r) => ({
          ...r,
          url: await this.resolveFileUrl(r.url, r.storageKey),
        })),
      ),
    ]);

    // O'quvchiga storage kalitlari ko'rsatilmaydi
    const { videoKey, ...publicLesson } = lesson;
    const base = staff ? lesson : publicLesson;

    return {
      ...base,
      resources: staff ? resources : resources.map(({ storageKey, ...r }) => r),
      video,
      prev: idx > 0 ? siblings[idx - 1] : null,
      next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
    };
  }

  /* ───────────── Materiallar ───────────── */

  async addResource(user: AuthUser, lessonId: string, dto: CreateResourceDto) {
    const lesson = await this.getLessonOrThrow(lessonId);
    await this.assertCanManageCourse(user, lesson.courseId);

    if (!dto.url && !dto.storageKey) {
      throw new BadRequestException('url yoki storageKey dan kamida bittasi kerak');
    }
    if (dto.storageKey && !dto.storageKey.startsWith(RESOURCE_KEY_PREFIX)) {
      throw new BadRequestException(
        'storageKey noto‘g‘ri. Avval POST /storage/presign (LESSON_RESOURCE) orqali yuklang',
      );
    }
    if (dto.url && !isHttpUrl(dto.url)) {
      throw new BadRequestException('url noto‘g‘ri (http yoki https bo‘lishi kerak)');
    }

    // Faqat kalit berilgan bo'lsa: ochiq manzil, bo'lmasa kalitning o'zi saqlanadi (o'qishda havola yaratiladi)
    const url = dto.url ?? this.storage.publicUrl(dto.storageKey as string) ?? (dto.storageKey as string);

    return this.prisma.lessonResource.create({
      data: {
        lessonId,
        title: dto.title.trim(),
        url,
        storageKey: dto.storageKey,
        kind: dto.kind,
      },
    });
  }

  async removeResource(user: AuthUser, resourceId: string) {
    const resource = await this.prisma.lessonResource.findUnique({
      where: { id: resourceId },
      include: { lesson: { select: { courseId: true } } },
    });
    if (!resource) throw new NotFoundException('Material topilmadi');
    await this.assertCanManageCourse(user, resource.lesson.courseId);

    await this.prisma.lessonResource.delete({ where: { id: resourceId } });
    await this.storage.remove(resource.storageKey);
    return { deleted: true };
  }

  /* ───────────── Progress ───────────── */

  async setProgress(user: AuthUser, lessonId: string, completed: boolean) {
    const lesson = await this.getLessonOrThrow(lessonId);

    if (!this.isStaff(user.role)) {
      if (!lesson.isPublished) throw new NotFoundException('Dars topilmadi');
      await this.courses.assertCanView(user, lesson.courseId);
    }

    const completedAt = completed ? new Date() : null;
    return this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: { userId: user.id, lessonId, completed, completedAt },
      update: { completed, completedAt },
      select: { lessonId: true, completed: true, completedAt: true },
    });
  }
}
