import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { Community as CommunityModel } from '../../prisma/generated/client';

@Injectable()
export class CommunitiesService {
  constructor(private prisma: PrismaService) {}

  create(
    ownerId: number,
    createCommunityDto: CreateCommunityDto,
  ): Promise<CommunityModel> {
    return this.prisma.community.create({
      data: {
        name: createCommunityDto.name.trim(),
        ownerId,
        memberships: { create: { userId: ownerId } },
      },
    });
  }

  async findForMember(userId: number): Promise<CommunityModel[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { community: true },
    });

    return memberships.map(({ community }) => community);
  }

  findOne(id: number): Promise<CommunityModel | null> {
    return this.prisma.community.findUnique({ where: { id } });
  }
}
