import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EmailConfirmationService } from './email-confirmation.service';
import { JwtAuthGuard } from './jwt.guard';
import { AllowUnconfirmed } from './confirmed-email.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { HOUR, MINUTE, RateLimit } from '../common/throttle';

@Controller('auth')
@AllowUnconfirmed()
export class AuthController {
  constructor(
    private authService: AuthService,
    private emailConfirmation: EmailConfirmationService,
  ) {}

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

  @RateLimit(10, MINUTE)
  @Post('confirm-email')
  confirmEmail(@Body() { token }: ConfirmEmailDto) {
    return this.emailConfirmation.confirm(token);
  }

  @RateLimit(3, HOUR)
  @Post('confirm-email/resend')
  @UseGuards(JwtAuthGuard)
  resendConfirmation(@Req() req) {
    return this.emailConfirmation.resend(req.user.userId);
  }
}
