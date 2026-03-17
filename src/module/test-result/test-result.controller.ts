import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { TestResultService } from './test-result.service';
import { CreateTestResultDto } from './dto/create-test-result.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/core/Guard/JwtGuard';
import { RolesGuard } from 'src/core/Guard/roles.guard';
import { UpdateTestResultDto } from './dto/update-test-result.dto';

@ApiTags('TestResults')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('test-result')
export class TestResultController {
  constructor(private readonly testResultService: TestResultService) {}

  @Post()
  @ApiOperation({ summary: 'Submit test result' })
  async create(@Req() req: any, @Body() dto: CreateTestResultDto) {
    // 🔥 TO‘G‘RI JOY
    const userId = req.user.id;

    return this.testResultService.create(userId, dto);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.testResultService.findAll(req.user.sub, req.user.role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.testResultService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update test result (ADMIN)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTestResultDto,
  ) {
    return this.testResultService.update(id, dto);
  }

  // 🔴 ADMIN — natijani o‘chirish
  @Delete(':id')
  @ApiOperation({ summary: 'Delete test result (ADMIN)' })
  async remove(@Param('id') id: string) {
    return this.testResultService.remove(id);
  }
}
