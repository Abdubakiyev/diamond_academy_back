import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

/* ───────────── Swagger namunalari (faqat hujjat uchun) ───────────── */

const ASSIGNMENT_ID = '8e7d6c5b-4a39-4281-9f0e-1d2c3b4a5968';
const SUBMISSION_ID = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';

const ASSIGNMENT_EXAMPLE = {
  id: ASSIGNMENT_ID,
  lessonId: '2c9d1e7a-3b4f-4c5d-8e6f-7a8b9c0d1e2f',
  title: 'Present Simple mashqlari',
  instructions: 'Darslikdagi 12-betdagi 1-5 mashqlarni bajaring va rasmga olib yuklang.',
  maxScore: 100,
  dueDate: '2026-12-01T18:00:00.000Z',
  allowText: true,
  allowFiles: true,
  createdAt: '2026-11-09T15:00:00.000Z',
  updatedAt: '2026-11-09T15:00:00.000Z',
};

const SUBMISSION_EXAMPLE = {
  id: SUBMISSION_ID,
  assignmentId: ASSIGNMENT_ID,
  userId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  text: 'Mana mening javoblarim: 1) goes 2) plays 3) studies',
  status: 'SUBMITTED',
  score: null,
  feedback: null,
  gradedById: null,
  gradedAt: null,
  files: [
    {
      id: 'f0e1d2c3-b4a5-4968-8776-5a4b3c2d1e0f',
      url: 'https://cdn.example.com/submissions/3f2b8c1e/homework-1.jpg',
      kind: 'IMAGE',
      fileName: 'homework-1.jpg',
      sizeBytes: 245760,
    },
  ],
  submittedAt: '2026-11-10T09:30:00.000Z',
  updatedAt: '2026-11-10T09:30:00.000Z',
};

const GRADED_EXAMPLE = {
  ...SUBMISSION_EXAMPLE,
  status: 'GRADED',
  score: 85,
  feedback: 'Yaxshi ish! 4-mashqdagi xatolarni to\'g\'rilang.',
  gradedById: '9b8a7c6d-5e4f-4321-a0b9-c8d7e6f5a4b3',
  gradedAt: '2026-11-10T12:00:00.000Z',
};

@ApiTags('Assignment')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@Controller('assignment')
@UseGuards(JwtGuard)
export class AssignmentController {
  constructor(private readonly assignments: AssignmentService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Vazifa yaratish', description: 'Faqat ADMIN yoki TEACHER.' })
  @ApiBody({
    type: CreateAssignmentDto,
    examples: {
      minimal: {
        summary: 'Minimal (faqat majburiy maydonlar)',
        value: {
          lessonId: '2c9d1e7a-3b4f-4c5d-8e6f-7a8b9c0d1e2f',
          title: 'Present Simple mashqlari',
          instructions: 'Darslikdagi 12-betdagi 1-5 mashqlarni bajaring.',
        },
      },
      full: {
        summary: 'To\'liq (muddat va ball bilan)',
        value: {
          lessonId: '2c9d1e7a-3b4f-4c5d-8e6f-7a8b9c0d1e2f',
          title: 'Present Simple mashqlari',
          instructions: 'Darslikdagi 12-betdagi 1-5 mashqlarni bajaring va rasmga olib yuklang.',
          maxScore: 100,
          dueDate: '2026-12-01T18:00:00Z',
          allowText: true,
          allowFiles: true,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Vazifa yaratildi', schema: { example: ASSIGNMENT_EXAMPLE } })
  @ApiBadRequestResponse({ description: 'Maydonlar noto\'g\'ri' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Dars topilmadi' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssignmentDto) {
    return this.assignments.create(user, dto);
  }

  @Get('submissions/:submissionId')
  @ApiOperation({
    summary: 'Bitta topshirilgan ishni olish',
    description: 'DIQQAT: \':id\' yo\'llaridan oldin turishi shart.',
  })
  @ApiParam({ name: 'submissionId', format: 'uuid', description: 'Topshirilgan ish ID', example: SUBMISSION_ID })
  @ApiOkResponse({ description: 'Topshirilgan ish ma\'lumotlari', schema: { example: SUBMISSION_EXAMPLE } })
  @ApiForbiddenResponse({ description: 'Bu ishni ko\'rishga ruxsat yo\'q' })
  @ApiNotFoundResponse({ description: 'Topshirilgan ish topilmadi' })
  getSubmission(
    @CurrentUser() user: AuthUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.assignments.getSubmission(user, submissionId);
  }

  @Patch('submissions/:submissionId/grade')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Ishni baholash yoki qayta ishlashga qaytarish',
    description: 'Faqat ADMIN yoki TEACHER. Qaytarishda returnForRevision=true va feedback yuboring.',
  })
  @ApiParam({ name: 'submissionId', format: 'uuid', description: 'Topshirilgan ish ID', example: SUBMISSION_ID })
  @ApiBody({
    type: GradeSubmissionDto,
    examples: {
      grade: {
        summary: 'Baho qo\'yish',
        value: { score: 85, feedback: 'Yaxshi ish! 4-mashqdagi xatolarni to\'g\'rilang.' },
      },
      returnForRevision: {
        summary: 'Qayta ishlashga qaytarish',
        value: { returnForRevision: true, feedback: '3 va 4-mashqlarni qaytadan bajaring.' },
      },
    },
  })
  @ApiOkResponse({ description: 'Baholangan ish', schema: { example: GRADED_EXAMPLE } })
  @ApiBadRequestResponse({ description: 'Ball maxScore dan oshib ketgan yoki qaytarishda feedback yo\'q' })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Topshirilgan ish topilmadi' })
  grade(
    @CurrentUser() user: AuthUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.assignments.grade(user, submissionId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta vazifani olish' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Vazifa ID', example: ASSIGNMENT_ID })
  @ApiOkResponse({ description: 'Vazifa ma\'lumotlari', schema: { example: ASSIGNMENT_EXAMPLE } })
  @ApiNotFoundResponse({ description: 'Vazifa topilmadi' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.findOne(user, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Vazifani tahrirlash', description: 'Faqat ADMIN yoki TEACHER.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Vazifa ID', example: ASSIGNMENT_ID })
  @ApiBody({
    type: UpdateAssignmentDto,
    examples: {
      title: { summary: 'Sarlavhani o\'zgartirish', value: { title: 'Present Simple: qayta ko\'rib chiqilgan' } },
      removeDueDate: { summary: 'Muddatni olib tashlash', value: { dueDate: null } },
    },
  })
  @ApiOkResponse({
    description: 'Yangilangan vazifa',
    schema: { example: { ...ASSIGNMENT_EXAMPLE, title: 'Present Simple: qayta ko\'rib chiqilgan' } },
  })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Vazifa topilmadi' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignments.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Vazifani o\'chirish', description: 'Faqat ADMIN yoki TEACHER.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Vazifa ID', example: ASSIGNMENT_ID })
  @ApiOkResponse({ description: 'Vazifa o\'chirildi', schema: { example: { deleted: true } } })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Vazifa topilmadi' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.remove(user, id);
  }

  @Get(':id/submissions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Vazifaga topshirilgan barcha ishlar',
    description: 'Filtr va sahifalash bilan. Faqat ADMIN yoki TEACHER.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Vazifa ID', example: ASSIGNMENT_ID })
  @ApiOkResponse({
    description: 'Topshirilgan ishlar ro\'yxati',
    schema: { example: { items: [SUBMISSION_EXAMPLE], total: 1, page: 1, limit: 20 } },
  })
  @ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
  @ApiNotFoundResponse({ description: 'Vazifa topilmadi' })
  listSubmissions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListSubmissionsQueryDto,
  ) {
    return this.assignments.listSubmissions(user, id, query);
  }

  @Post(':id/submit')
  @ApiOperation({
    summary: 'Ishni topshirish',
    description: 'O\'quvchi ishini topshiradi. Qayta yuborsa, avvalgisi yangilanadi. Fayllar avval /storage/presign orqali yuklanadi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Vazifa ID', example: ASSIGNMENT_ID })
  @ApiBody({
    type: SubmitAssignmentDto,
    examples: {
      textOnly: {
        summary: 'Faqat matn',
        value: { text: 'Mana mening javoblarim: 1) goes 2) plays 3) studies' },
      },
      withFiles: {
        summary: 'Matn va rasm bilan',
        value: {
          text: 'Javoblarim rasmda.',
          files: [
            { storageKey: 'submissions/3f2b8c1e/homework-1.jpg', fileName: 'homework-1.jpg', sizeBytes: 245760, kind: 'IMAGE' },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Ish topshirildi (yoki yangilandi)', schema: { example: SUBMISSION_EXAMPLE } })
  @ApiBadRequestResponse({ description: 'Bu vazifada matn yoki fayl qabul qilinmaydi / bo\'sh topshirish' })
  @ApiNotFoundResponse({ description: 'Vazifa topilmadi' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.assignments.submit(user, id, dto);
  }

  @Get(':id/my-submission')
  @ApiOperation({
    summary: 'O\'quvchining o\'z ishi',
    description: 'Joriy foydalanuvchining shu vazifaga topshirgan ishini qaytaradi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Vazifa ID', example: ASSIGNMENT_ID })
  @ApiOkResponse({ description: 'Foydalanuvchining topshirgan ishi', schema: { example: SUBMISSION_EXAMPLE } })
  @ApiNotFoundResponse({ description: 'Vazifa yoki topshirilgan ish topilmadi' })
  mySubmission(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.getMySubmission(user, id);
  }
}
