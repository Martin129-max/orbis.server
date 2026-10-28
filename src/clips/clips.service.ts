import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TwitchLiveService, ClipPage } from '../friends/twitch-live.service';
import { canViewProfile } from '../posts/wall-access';
import { normalizeUsername } from '../users/username';

@Injectable()
export class ClipsService {
  constructor(
    private prisma: PrismaService,
    private twitch: TwitchLiveService,
  ) {}

  async forCommunity(communityId: number, cursor?: string): Promise<ClipPage> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { twitchUserId: true },
    });
    if (!community?.twitchUserId) {
      throw new NotFoundException('This community hasn’t connected Twitch');
    }
    return this.twitch.clips(community.twitchUserId, cursor);
  }

  async forUser(
    viewerId: number,
    username: string,
    cursor?: string,
  ): Promise<ClipPage> {
    const user = await this.prisma.user.findUnique({
      where: { username: normalizeUsername(username) },
      select: {
        id: true,
        isPublic: true,
        oauthAccounts: {
          where: { provider: 'twitch', showClips: true },
          select: { providerAccountId: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!(await canViewProfile(this.prisma, viewerId, user))) {
      throw new ForbiddenException('This profile is private');
    }

    const [account] = user.oauthAccounts;
    if (!account) throw new NotFoundException('No clips to show');
    return this.twitch.clips(account.providerAccountId, cursor);
  }
}
