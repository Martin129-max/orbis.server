import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthProvider } from '../../../prisma/generated/client';
import { MINUTE, RateLimit } from '../../common/throttle';
import { AllowGuest } from '../allow-guest';
import { JwtAuthGuard } from '../jwt.guard';
import { CompleteOAuthDto } from './dto/complete-oauth.dto';
import { OAuthConnections, OAuthResult, OAuthService } from './oauth.service';

const provider = new ParseEnumPipe(AuthProvider);

@Controller('auth/oauth')
export class OAuthController {
  constructor(private oauth: OAuthService) {}

  @Get('providers')
  providers(): AuthProvider[] {
    return this.oauth.enabled();
  }

  @Get('connections')
  @UseGuards(JwtAuthGuard)
  connections(@Req() req): Promise<OAuthConnections> {
    return this.oauth.connections(req.user.userId);
  }

  @Delete('connections/:provider')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  disconnect(
    @Req() req,
    @Param('provider', provider) name: AuthProvider,
  ): Promise<void> {
    return this.oauth.disconnect(req.user.userId, name);
  }

  @RateLimit(30, MINUTE)
  @Get(':provider/url')
  url(
    @Param('provider', provider) name: AuthProvider,
    @Query('nonce') nonce = '',
  ) {
    return { url: this.oauth.authorizeUrl(name, nonce, null) };
  }

  @RateLimit(30, MINUTE)
  @Get(':provider/link-url')
  @UseGuards(JwtAuthGuard)
  linkUrl(
    @Req() req,
    @Param('provider', provider) name: AuthProvider,
    @Query('nonce') nonce = '',
  ) {
    return { url: this.oauth.authorizeUrl(name, nonce, req.user.userId) };
  }

  @RateLimit(10, MINUTE)
  @Post(':provider')
  @AllowGuest()
  @UseGuards(JwtAuthGuard)
  complete(
    @Req() req,
    @Param('provider', provider) name: AuthProvider,
    @Body() body: CompleteOAuthDto,
  ): Promise<OAuthResult> {
    return this.oauth.complete(name, body, req.user.userId);
  }
}
