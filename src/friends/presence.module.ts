import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PresenceGateway } from './presence.gateway';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  providers: [PresenceGateway, PrismaService],
  exports: [PresenceGateway],
})
export class PresenceModule {}
