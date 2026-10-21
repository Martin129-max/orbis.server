import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    PassportModule,
    StorageModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy, UsersService, PrismaService],
  controllers: [AuthController],
})
export class AuthModule {}
