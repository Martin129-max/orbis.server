import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { HOUR, MINUTE, RateLimit } from '../common/throttle';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @RateLimit(3, HOUR)
  @Post('signup')
  signup(@Body() body: CreateUserDto) {
    return this.authService.signup(body);
  }

  @RateLimit(10, MINUTE)
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.identifier, body.password);
  }
}
