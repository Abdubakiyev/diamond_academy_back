import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtGuard, Roles, RolesGuard } from '../../common/guards';
import { ScoringService } from './scoring.service';

@ApiTags('Scoring')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token yo\'q yoki yaroqsiz' })
@ApiForbiddenResponse({ description: 'Ruxsat yo\'q (faqat ADMIN)' })
@Controller('scoring')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Post('attempts/:attemptId/recalculate')
  @ApiOperation({
    summary: 'Urinish ballini qayta hisoblash',
    description: 'O\'tkazish jadvali o\'zgargandan keyin urinishning Listening / Reading ballini qayta hisoblaydi. Faqat ADMIN.',
  })
  @ApiParam({ name: 'attemptId', format: 'uuid', description: 'Urinish ID' })
  @ApiCreatedResponse({ description: 'Ball qayta hisoblandi' })
  @ApiNotFoundResponse({ description: 'Urinish topilmadi' })
  recalculate(@Param('attemptId', ParseUUIDPipe) attemptId: string) {
    return this.scoring.recalculateAttempt(attemptId);
  }
}
