import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'User register (login yo‘q)' })
  @ApiResponse({
    status: 201,
    description: 'Token va redirect qaytadi',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

}
