import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { CommunitiesModule } from '../communities/communities.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [CommunitiesModule],
  controllers: [InvitesController],
  providers: [InvitesService, CommunityMemberGuard, PrismaService],
})
export class InvitesModule {}
