import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Patch,
    Delete,
    UseGuards,
  } from '@nestjs/common';
  import { TestService } from './test.service';
  import { CreateTestDto } from './dto/create-test.dto';
  import { UpdateTestDto } from './dto/update-test.dto';
  import { Role } from '@prisma/client';
  import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/core/Guard/JwtGuard';
import { RolesGuard } from 'src/core/Guard/roles.guard';
import { Roles } from 'src/core/Guard/roles.decorator';
  
  @ApiTags('Tests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Controller('test')
  export class TestController {
    constructor(private readonly testService: TestService) {}
  
    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Create a test' })
    create(@Body() dto: CreateTestDto) {
      return this.testService.create(dto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all tests (USER + ADMIN)' })
    findAll() {
      return this.testService.findAll();
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get one test by id' })
    findOne(@Param('id') id: string) {
      return this.testService.findOne(id);
    }
  
    @Patch(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Update test' })
    update(@Param('id') id: string, @Body() dto: UpdateTestDto) {
      return this.testService.update(id, dto);
    }
  
    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Delete test' })
    remove(@Param('id') id: string) {
      return this.testService.remove(id);
    }
  }
  