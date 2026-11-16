import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
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
import { AiEvaluationService } from './ai-evaluation.service';
import { ListEvaluationsQueryDto } from './dto/list-evaluations-query.dto';
import { ReviewEvaluationDto } from './dto/review-evaluation.dto';

/* ───────────── Swagger namunalari (faqat hujjat uchun) ───────────── */

const EVAL_ID = '3f2b8c1e-5a4d-4e0b-9d1a-7c6b5a4d3e2f';
const SECTION_ATTEMPT_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';

const EVAL_EXAMPLE = {
  id: EVAL_ID,
  answerId: '9a8b7c6d-1e2f-4a3b-8c5d-0e1f2a3b4c5d',
  status: 'DONE',
  model: 'gpt-4o',
  score: 58.5,
  criteria: { task: 60, coherence: 55, lexis: 58, grammar: 61 },
  feedback: 'Javob mavzuga mos, lekin paragraflar orasidagi bog\'lanish kuchsiz.',
  suggestions: ['Linking words ishlating', 'Present perfect ni takrorlang'],
  errorMessage: null,
  finalScore: null,
  reviewedById: null,
  reviewedAt: null,
  createdAt: '2026-11-09T15:00:00.000Z',
  updatedAt: '2026-11-09T15:01:10.000Z',
};

const LIST_EXAMPLE = { items: [EVAL_EXAMPLE], total: 1, page: 1, limit: 20 };

const STATS_EXAMPLE = { PENDING: 3, PROCESSING: 1, DONE: 42, FAILED: 2 };

@ApiTags('AI Evaluation')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN yoki TEACHER)' })
@Controller('ai-evaluation')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
export class AiEvaluationController {
  constructor(private readonly evaluations: AiEvaluationService) {}

  @Get()
  @ApiOperation({
    summary: 'AI baholashlar ro\'yxati',
    description: 'Writing / Speaking bo\'limlari bo\'yicha AI baholashlarni filtr va sahifalash bilan qaytaradi.',
  })
  @ApiOkResponse({ description: 'Baholashlar ro\'yxati', schema: { example: LIST_EXAMPLE } })
  @ApiBadRequestResponse({ description: 'Filtr parametrlari noto\'g\'ri' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListEvaluationsQueryDto) {
    return this.evaluations.list(user, query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Navbat holati',
    description: 'AI baholash navbatining joriy statistikasi. DIQQAT: \':id\' yo\'llaridan oldin turishi shart.',
  })
  @ApiOkResponse({ description: 'Navbat statistikasi', schema: { example: STATS_EXAMPLE } })
  stats() {
    return this.evaluations.stats();
  }

  @Post('section-attempts/:sectionAttemptId/enqueue')
  @ApiOperation({
    summary: 'Bo\'limni qo\'lda navbatga qo\'yish',
    description: 'Sinash yoki qayta baholash uchun. Faqat ADMIN.',
  })
  @ApiParam({
    name: 'sectionAttemptId',
    format: 'uuid',
    description: 'Section attempt ID',
    example: SECTION_ATTEMPT_ID,
  })
  @ApiOkResponse({ description: 'Bo\'lim navbatga qo\'yildi', schema: { example: { queued: 2 } } })
  @ApiForbiddenResponse({ description: 'Faqat admin' })
  @ApiNotFoundResponse({ description: 'Section attempt topilmadi' })
  enqueue(
    @CurrentUser() user: AuthUser,
    @Param('sectionAttemptId', ParseUUIDPipe) sectionAttemptId: string,
  ) {
    if (user.role !== Role.ADMIN) throw new ForbiddenException('Faqat admin');
    return this.evaluations.enqueueSection(sectionAttemptId, { force: true });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta AI baholashni olish' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Evaluation ID', example: EVAL_ID })
  @ApiOkResponse({ description: 'Baholash ma\'lumotlari', schema: { example: EVAL_EXAMPLE } })
  @ApiNotFoundResponse({ description: 'Baholash topilmadi' })
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.evaluations.getOne(user, id);
  }

  @Patch(':id/review')
  @ApiOperation({
    summary: 'AI bahosini o\'zgartirish',
    description: 'O\'qituvchi yoki admin AI bergan bahoni qo\'lda tahrirlaydi. finalScore majburiy (0-75).',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Evaluation ID', example: EVAL_ID })
  @ApiBody({
    type: ReviewEvaluationDto,
    examples: {
      scoreOnly: {
        summary: 'Faqat ballni o\'zgartirish',
        value: { finalScore: 62.5 },
      },
      scoreAndFeedback: {
        summary: 'Ball va izoh bilan',
        value: { finalScore: 62.5, feedback: 'Grammatika yaxshi, lug\'at boyroq bo\'lishi mumkin.' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Yangilangan baholash',
    schema: {
      example: {
        ...EVAL_EXAMPLE,
        finalScore: 62.5,
        feedback: 'Grammatika yaxshi, lug\'at boyroq bo\'lishi mumkin.',
        reviewedById: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
        reviewedAt: '2026-11-09T16:20:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'finalScore 0-75 oralig\'ida bo\'lishi kerak' })
  @ApiNotFoundResponse({ description: 'Baholash topilmadi' })
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewEvaluationDto,
  ) {
    return this.evaluations.review(user, id, dto);
  }

  @Post(':id/retry')
  @ApiOperation({
    summary: 'Baholashni qayta urinish',
    description: 'Muvaffaqiyatsiz bo\'lgan AI baholashni qaytadan navbatga qo\'yadi.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Evaluation ID', example: EVAL_ID })
  @ApiOkResponse({
    description: 'Qayta urinish boshlandi',
    schema: {
      example: { ...EVAL_EXAMPLE, status: 'PENDING', score: null, criteria: null, feedback: null },
    },
  })
  @ApiNotFoundResponse({ description: 'Baholash topilmadi' })
  retry(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.evaluations.retry(user, id);
  }
}
