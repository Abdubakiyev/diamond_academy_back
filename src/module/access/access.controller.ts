// access.controller.ts
import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AccessService } from './access.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // agar JWT guard bo'lsa

@Controller('access')
export class AccessController {
  constructor(private accessService: AccessService) {}

  // POST /access/check - USER UCHUN
  @Post('check')
  async check(@Body('code') code: string) {
    return this.accessService.checkCode(code);
  }

  // GET /access/current - ADMIN UCHUN
  // @UseGuards(JwtAuthGuard) // agar JWT guard bo'lsa uncomment qiling
  @Get('current')
  async getCurrentCode() {
    return this.accessService.getCurrentCode();
  }

  // GET /access/generate - ADMIN YANGI KOD OLISH (manual)
  // @UseGuards(JwtAuthGuard)
  @Get('generate')
  async generateNewCode() {
    return this.accessService.refreshAccessCode();
  }
}