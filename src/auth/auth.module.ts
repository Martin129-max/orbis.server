import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { OAuthController } from './oauth/oauth.controller';
import { OAuthService } from './oauth/oauth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma.service';
import { StorageModule } from '../storage/storage.module';
import { PresenceModule } from '../friends/presence.module';
import { CommunitiesModule } from '../communities/communities.module';

@Module({
  imports: [
    PassportModule,
    StorageModule,
    PresenceModule,
    CommunitiesModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    AuthService,
    OAuthService,
    JwtStrategy,
    UsersService,
    PrismaService,
  ],
  controllers: [AuthController, OAuthController],
})
export class AuthModule {}
