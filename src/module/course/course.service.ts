import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { SetCourseGroupsDto } from './dto/set-course-groups.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  private isStaff(role: Role) {
    return role === Role.ADMIN || role === Role.TEACHER;
  }

  /* ───────────── Yordamchilar ───────────── */

  /** O'quvchi o'qiydigan guruhlar (faol Student yozuvlari bo'yicha) */
  private async userGroupIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.student.findMany({
      where: { userId, isActive: true },
      select: { groupId: true },
    });
    return rows.map((r) => r.groupId);
  }

  private async assertLevel(levelId: string) {
    const level = await this.prisma.level.findUnique({ where: { id: levelId }, select: { id: true } });
    if (!level) throw new BadRequestException('Bunday level topilmadi');
  }

  private async getOrThrow(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Kurs topilmadi');
    return course;
  }

  /** ADMIN hammasini, TEACHER faqat o'zi yaratgan kursni boshqaradi */
  private assertCanManage(user: AuthUser, course: { createdById: string }) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.TEACHER && course.createdById === user.id) return;
    throw new ForbiddenException('Bu kursni boshqarish huquqingiz yo‘q');
  }

  /**
   * Foydalanuvchi kursni ko'ra oladimi? (dars va vazifa modullari ham shuni ishlatadi)
   * Admin / o'qituvchi — hammasini. O'quvchi — faqat e'lon qilingan va o'z guruhiga biriktirilgan kursni.
   */
  async assertCanView(user: AuthUser, courseId: string) {
    if (this.isStaff(user.role)) return;

    const groupIds = await this.userGroupIds(user.id);
    const count = await this.prisma.course.count({
      where: { id: courseId, isPublished: true, groups: { some: { groupId: { in: groupIds } } } },
    });
    if (count === 0) throw new ForbiddenException('Bu kursni ko‘rish huquqingiz yo‘q');
  }

  /* ───────────── CRUD ───────────── */

  async create(user: AuthUser, dto: CreateCourseDto) {
    if (dto.levelId) await this.assertLevel(dto.levelId);

    return this.prisma.course.create({
      data: {
        title: dto.title.trim(),
        description: dto.description,
        coverUrl: dto.coverUrl,
        levelId: dto.levelId,
        isPublished: dto.isPublished ?? false,
        createdById: user.id,
      },
      include: { level: { select: { id: true, type: true } } },
    });
  }

  async findAll(user: AuthUser, query: ListCoursesQueryDto) {
    const staff = this.isStaff(user.role);
    const where: Prisma.CourseWhereInput = {};

    if (query.levelId) where.levelId = query.levelId;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    if (staff) {
      if (query.published) where.isPublished = query.published === 'true';
    } else {
      const groupIds = await this.userGroupIds(user.id);
      where.isPublished = true;
      where.groups = { some: { groupId: { in: groupIds } } };
    }

    return this.prisma.course.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        level: { select: { id: true, type: true } },
        // O'quvchiga faqat e'lon qilingan darslar soni ko'rsatiladi
        _count: { select: { lessons: staff ? true : { where: { isPublished: true } } } },
        ...(staff ? { groups: { include: { group: { select: { id: true, name: true } } } } } : {}),
      },
    });
  }

  async findOne(user: AuthUser, id: string) {
    await this.assertCanView(user, id);
    const staff = this.isStaff(user.role);

    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        level: { select: { id: true, type: true } },
        lessons: {
          where: staff ? undefined : { isPublished: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            isPublished: true,
            videoSource: true,
            durationSec: true,
            // O'quvchi uchun: dars tugatilganmi
            ...(staff ? {} : { progress: { where: { userId: user.id }, select: { completed: true } } }),
          },
        },
        ...(staff ? { groups: { include: { group: { select: { id: true, name: true } } } } } : {}),
      },
    });
    if (!course) throw new NotFoundException('Kurs topilmadi');
    return course;
  }

  async update(user: AuthUser, id: string, dto: UpdateCourseDto) {
    const course = await this.getOrThrow(id);
    this.assertCanManage(user, course);
    if (dto.levelId) await this.assertLevel(dto.levelId);

    return this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        coverUrl: dto.coverUrl,
        levelId: dto.levelId,
        isPublished: dto.isPublished,
      },
      include: { level: { select: { id: true, type: true } } },
    });
  }

  /** Diqqat: kurs o'chsa, uning darslari, vazifalari va o'quvchi topshirgan ishlar ham o'chadi (Cascade) */
  async remove(user: AuthUser, id: string) {
    const course = await this.getOrThrow(id);
    this.assertCanManage(user, course);
    await this.prisma.course.delete({ where: { id } });
    return { deleted: true };
  }

  /* ───────────── Guruhlarga biriktirish ───────────── */

  async setGroups(user: AuthUser, id: string, dto: SetCourseGroupsDto) {
    const course = await this.getOrThrow(id);
    this.assertCanManage(user, course);

    const found = await this.prisma.group.count({ where: { id: { in: dto.groupIds } } });
    if (found !== dto.groupIds.length) {
      throw new BadRequestException('Ba’zi guruhlar topilmadi');
    }

    await this.prisma.$transaction([
      this.prisma.groupCourse.deleteMany({ where: { courseId: id } }),
      this.prisma.groupCourse.createMany({
        data: dto.groupIds.map((groupId) => ({ groupId, courseId: id })),
      }),
    ]);

    return this.findOne(user, id);
  }
}
