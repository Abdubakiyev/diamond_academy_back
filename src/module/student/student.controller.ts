import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { StudentService } from './student.service';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/core/Guard/JwtGuard';
import { RolesGuard } from 'src/core/Guard/roles.guard';
import { Roles } from 'src/core/Guard/roles.decorator';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createStudentDto: { name: string; phone?: string; groupId: string }) {
    return this.studentService.create(createStudentDto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(@Query('groupId') groupId?: string) {
    return this.studentService.findAll(groupId);
  }

  @Get('by-group/:groupId')
  @Roles(Role.ADMIN)
  findByGroup(@Param('groupId') groupId: string) {
    return this.studentService.findByGroup(groupId);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.studentService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateStudentDto: { name?: string; phone?: string; groupId?: string; isActive?: boolean },
  ) {
    return this.studentService.update(id, updateStudentDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.studentService.remove(id);
  }
}