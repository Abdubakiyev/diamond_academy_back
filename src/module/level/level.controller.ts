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
  import { LevelService } from './level.service';
  import { CreateLevelDto } from './dto/create-level.dto';
  import { UpdateLevelDto } from './dto/update-level.dto';

  import { Role } from '@prisma/client';
  import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/core/Guard/JwtGuard';
import { RolesGuard } from 'src/core/Guard/roles.guard';
import { Roles } from 'src/core/Guard/roles.decorator';
  
  @ApiTags('Levels')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Controller('level')
  export class LevelController {
    constructor(private readonly levelService: LevelService) {}
  
    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Create a level' })
    create(@Body() dto: CreateLevelDto) {
      return this.levelService.create(dto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all levels (USER + ADMIN)' })
    findAll() {
      return this.levelService.findAll();
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get one level by id' })
    findOne(@Param('id') id: string) {
      return this.levelService.findOne(id);
    }
  
    @Patch(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Update level' })
    update(@Param('id') id: string, @Body() dto: UpdateLevelDto) {
      return this.levelService.update(id, dto);
    }
  
    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Delete level' })
    remove(@Param('id') id: string) {
      return this.levelService.remove(id);
    }
}  