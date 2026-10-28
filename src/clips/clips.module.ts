import { Module } from '@nestjs/common';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';
import { CommunityViewerGuard } from '../communities/community-viewer.guard';
import { PresenceModule } from '../friends/presence.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [PresenceModule],
  controllers: [ClipsController],
  providers: [ClipsService, CommunityViewerGuard, PrismaService],
})
export class ClipsModule {}
