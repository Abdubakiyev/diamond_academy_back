import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { ParentLinkStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/core/Guard/JwtGuard';
import { RolesGuard } from 'src/core/Guard/roles.guard';
import { Roles } from 'src/core/Guard/roles.decorator';
import { CurrentUser } from 'src/common/current-user.decorator';
import { ParentService } from './parent.service';
import { LinkChildDto, ParentRegisterDto, ReviewLinkDto } from './dto/parent.dto';

const ParentOnly = () => applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles(Role.PARENT));
const AdminOnly = () => applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles(Role.ADMIN));

@Controller('parent')
export class ParentController {
  constructor(private readonly parents: ParentService) {}

  /** Ochiq: ota-ona ro'yxatdan o'tadi (yoki kiradi) */
  @Post('register')
  register(@Body() dto: ParentRegisterDto) {
    return this.parents.register(dto);
  }

  @Get('groups')
  @ParentOnly()
  groups() {
    return this.parents.listGroups();
  }

  @Get('groups/:groupId/students')
  @ParentOnly()
  groupStudents(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.parents.groupStudents(groupId);
  }

  @Get('children')
  @ParentOnly()
  children(@CurrentUser('id') parentId: string) {
    return this.parents.myChildren(parentId);
  }

  @Post('children')
  @ParentOnly()
  addChild(@CurrentUser('id') parentId: string, @Body() dto: LinkChildDto) {
    return this.parents.addChild(parentId, dto.studentId);
  }

  @Get('children/:studentId/stats')
  @ParentOnly()
  childStats(
    @CurrentUser('id') parentId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.parents.childStats(parentId, studentId);
  }

  @Delete('children/:linkId')
  @ParentOnly()
  removeChild(@CurrentUser('id') parentId: string, @Param('linkId', ParseUUIDPipe) linkId: string) {
    return this.parents.removeChild(parentId, linkId);
  }

  /* ───────────── Admin ───────────── */

  @Get('admin/requests')
  @AdminOnly()
  requests(@Query('status', new ParseEnumPipe(ParentLinkStatus, { optional: true })) status?: ParentLinkStatus) {
    return this.parents.listRequests(status);
  }

  @Patch('admin/requests/:id')
  @AdminOnly()
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewLinkDto) {
    return this.parents.review(id, dto.status);
  }
}
