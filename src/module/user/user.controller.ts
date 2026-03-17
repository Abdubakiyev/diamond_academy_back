import {
    Controller,
    Get,
    Patch,
    Param,
    Body,
    Delete,
    UseGuards,
    Req,
  } from '@nestjs/common';
  import { UserService } from './user.service';
  import { UpdateUserDto } from './dto/update-user.dto';
  import { Role } from '@prisma/client';
  import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/core/Guard/JwtGuard';
import { RolesGuard } from 'src/core/Guard/roles.guard';
import { Roles } from 'src/core/Guard/roles.decorator';
  
  @ApiTags('Users')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Controller('user')
  export class UserController {
    constructor(private readonly userService: UserService) {}
  
    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Get all users' })
    findAll() {
      return this.userService.findAll();
    }
  
    @Get('me')
    @ApiOperation({ summary: 'Get own profile' })
    me(@Req() req) {
      return this.userService.findOne(req.user.sub);
    }
  
    @Get(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Get user by ID' })
    findOne(@Param('id') id: string) {
      return this.userService.findOne(id);
    }
  
    @Patch(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Update user' })
    update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
      return this.userService.update(id, dto);
    }
  
    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin: Delete user' })
    remove(@Param('id') id: string) {
      return this.userService.remove(id);
    }
  }
  