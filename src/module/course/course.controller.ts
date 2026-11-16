import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/current-user.decorator';
import { JwtGuard, Roles, RolesGuard } from '../../common/guards';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { SetCourseGroupsDto } from './dto/set-course-groups.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

/* ───────────── Swagger namunalari (faqat hujjat uchun) ───────────── */

const COURSE_ID = 'd4c3b2a1-9f8e-4d7c-a6b5-4c3d2e1f0a9b';
const LEVEL_ID = '4b3a2c1d-0e9f-4a8b-9c7d-6e5f4a3b2c1d';
const GROUP_ID_1 = '6a5b4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d';
const GROUP_ID_2 = 'b7a6c5d4-e3f2-4a1b-8c9d-0e1f2a3b4c5d';

const COURSE_EXAMPLE = {
  id: COURSE_ID,
  title: 'English A1 - Beginner',
  description: 'Noldan boshlovchilar uchun umumiy ingliz tili kursi.',
  coverUrl: 'https://cdn.example.com/covers/a1.jpg',
  levelId: LEVEL_ID,
  isPublished: true,
  createdById: '9b8a7c6d-5e4f-4321-a0b9-c8d7e6f5a4b3',
  createdAt: '2026-11-09T15:00:00.000Z',
  updatedAt: '2026-11-09T15:00:00.000Z',
};

const LESSON_EXAMPLE = {
  id: '2c9d1e7a-3b4f-4c5d-8e6f-7a8b9c0d1e2f',
  courseId: COURSE_ID,
  title: 'Lesson 1: Greetings',
  order: 1,
  isPublished: true,
  videoSource: 'YOUTUBE',
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  durationSec: 600,
};

@ApiTags('Course')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@Controller('course')
@UseGuards(JwtGuard)
export class CourseController {
  constructor(private readonly courses: CourseService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Kurs yaratish', description: 'Faqat ADMIN yoki TEACHER.' })
  @ApiBody({
    type: CreateCourseDto,
    examples: {
      minimal: { summary: 'Minimal (faqat sarlavha)', value: { title: 'English A1 - Beginner' } },
      full: {
        summary: 'To\'liq',
        value: {
          title: 'English A1 - Beginner',
          description: 'Noldan boshlovchilar uchun umumiy ingliz tili kursi.',
          coverUrl: 'https://cdn.example.com/covers/a1.jpg',
          levelId: LEVEL_ID,
          isPublished: true,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Kurs yaratildi', schema: { example: COURSE_EXAMPLE } })
  @ApiBadRequestResponse({ description: 'Maydonlar noto\'g\'ri' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Daraja (levelId) topilmadi' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCourseDto) {
    return this.courses.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Kurslar ro\'yxati',
    description:
      'ADMIN / TEACHER barcha kurslarni ko\'radi, o\'quvchi faqat o\'z guruhiga biriktirilgan kurslarni ko\'radi.',
  })
  @ApiOkResponse({ description: 'Kurslar ro\'yxati', schema: { example: [COURSE_EXAMPLE] } })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListCoursesQueryDto) {
    return this.courses.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Kurs va uning darslari',
    description: 'Kursning ma\'lumotlari darslari bilan birga qaytariladi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Kurs ID', example: COURSE_ID })
  @ApiOkResponse({
    description: 'Kurs ma\'lumotlari va darslar',
    schema: { example: { ...COURSE_EXAMPLE, lessons: [LESSON_EXAMPLE] } },
  })
  @ApiForbiddenResponse({ description: 'Bu kursni ko\'rishga ruxsat yo\'q' })
  @ApiNotFoundResponse({ description: 'Kurs topilmadi' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.courses.findOne(user, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Kursni tahrirlash', description: 'Faqat ADMIN yoki TEACHER.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Kurs ID', example: COURSE_ID })
  @ApiBody({
    type: UpdateCourseDto,
    examples: {
      title: { summary: 'Sarlavhani o\'zgartirish', value: { title: 'English A1 - yangilangan' } },
      publish: { summary: 'Nashr qilish', value: { isPublished: true } },
      clear: { summary: 'Tavsif va muqovani tozalash', value: { description: null, coverUrl: null } },
    },
  })
  @ApiOkResponse({
    description: 'Yangilangan kurs',
    schema: { example: { ...COURSE_EXAMPLE, title: 'English A1 - yangilangan' } },
  })
  @ApiBadRequestResponse({ description: 'Maydonlar noto\'g\'ri' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Kurs topilmadi' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courses.update(user, id, dto);
  }

  @Put(':id/groups')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Kursni ko\'ra oladigan guruhlarni belgilash',
    description:
      'Yuborilgan guruhlar ro\'yxati avvalgisini to\'liq almashtiradi. Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Kurs ID', example: COURSE_ID })
  @ApiBody({
    type: SetCourseGroupsDto,
    examples: {
      two: { summary: 'Ikki guruhga ochish', value: { groupIds: [GROUP_ID_1, GROUP_ID_2] } },
      none: { summary: 'Hech kimga (hammasini olib tashlash)', value: { groupIds: [] } },
    },
  })
  @ApiOkResponse({
    description: 'Kursga biriktirilgan guruhlar yangilandi',
    schema: { example: { courseId: COURSE_ID, groupIds: [GROUP_ID_1, GROUP_ID_2] } },
  })
  @ApiBadRequestResponse({ description: 'groupIds noto\'g\'ri yoki takrorlangan' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Kurs yoki guruh topilmadi' })
  setGroups(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCourseGroupsDto,
  ) {
    return this.courses.setGroups(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Kursni o\'chirish', description: 'Faqat ADMIN yoki TEACHER.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Kurs ID', example: COURSE_ID })
  @ApiOkResponse({ description: 'Kurs o\'chirildi', schema: { example: { deleted: true } } })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Kurs topilmadi' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.courses.remove(user, id);
  }
}
