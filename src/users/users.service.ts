import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { User as UserModel } from '../../prisma/generated/client';
import { normalizeUsername } from './username';
import { StorageService } from '../storage/storage.service';

export type PublicUser = Omit<UserModel, 'password'>;

export type Onboarding = {
  tourCompleted: boolean;
  checklistDismissed: boolean;
  steps: {
    avatar: boolean;
    community: boolean;
    post: boolean;
    comment: boolean;
    friend: boolean;
    feedback: boolean;
  };
};

export type Profile = Pick<
  UserModel,
  | 'email'
  | 'username'
  | 'avatarUrl'
  | 'theme'
  | 'appearOffline'
  | 'isAdmin'
  | 'createdAt'
> & {
  userId: number;
};

const omitPassword = { password: true } as const;

const profile = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  theme: true,
  appearOffline: true,
  isAdmin: true,
  createdAt: true,
} as const;

function toProfile({
  id,
  ...user
}: Pick<UserModel, keyof typeof profile>): Profile {
  return { userId: id, ...user };
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        username: normalizeUsername(createUserDto.username),
        password: await bcrypt.hash(createUserDto.password, 10),
      },
      omit: omitPassword,
    });
  }

  async findProfile(id: number): Promise<Profile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: profile,
    });

    return user && toProfile(user);
  }

  async updatePreferences(
    id: number,
    { theme, appearOffline }: UpdatePreferencesDto,
  ): Promise<Profile> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { theme, appearOffline },
      select: profile,
    });

    return toProfile(user);
  }

  async updateAvatar(id: number, file: Buffer): Promise<Profile> {
    const { url } = await this.storage.uploadImage(file, 'avatars', 512);
    return this.replaceAvatar(id, url);
  }

  removeAvatar(id: number): Promise<Profile> {
    return this.replaceAvatar(id, null);
  }

  private async replaceAvatar(
    id: number,
    avatarUrl: string | null,
  ): Promise<Profile> {
    const previous = await this.prisma.user.findUnique({
      where: { id },
      select: { avatarUrl: true },
    });
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl },
      select: profile,
    });

    const previousKey =
      previous?.avatarUrl && this.storage.keyFor(previous.avatarUrl);
    if (previousKey) await this.storage.delete(previousKey).catch(() => {});

    return toProfile(user);
  }

  async onboarding(id: number): Promise<Onboarding> {
    const [user, memberships, posts, threads, comments, friendships, reports] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id },
          select: {
            avatarUrl: true,
            tourCompletedAt: true,
            checklistDismissedAt: true,
          },
        }),
        this.prisma.membership.count({ where: { userId: id } }),
        this.prisma.post.count({ where: { authorId: id } }),
        this.prisma.thread.count({ where: { authorId: id } }),
        this.prisma.comment.count({ where: { authorId: id } }),
        this.prisma.friendship.count({
          where: {
            OR: [{ requesterId: id }, { addresseeId: id, status: 'accepted' }],
          },
        }),
        this.prisma.report.count({ where: { authorId: id } }),
      ]);

    return {
      tourCompleted: user.tourCompletedAt !== null,
      checklistDismissed: user.checklistDismissedAt !== null,
      steps: {
        avatar: user.avatarUrl !== null,
        community: memberships > 0,
        post: posts + threads > 0,
        comment: comments > 0,
        friend: friendships > 0,
        feedback: reports > 0,
      },
    };
  }

  async updateOnboarding(
    id: number,
    { tourCompleted, checklistDismissed }: UpdateOnboardingDto,
  ): Promise<Onboarding> {
    const at = (value?: boolean) =>
      value === undefined ? undefined : value ? new Date() : null;

    await this.prisma.user.update({
      where: { id },
      data: {
        tourCompletedAt: at(tourCompleted),
        checklistDismissedAt: at(checklistDismissed),
      },
    });
    return this.onboarding(id);
  }

  findByEmail(email: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }
}
