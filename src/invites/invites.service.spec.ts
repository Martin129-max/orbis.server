import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { PrismaService } from '../prisma.service';
import { CommunitiesService } from '../communities/communities.service';
import { buildInviteCard } from './invite-card';

jest.mock('./invite-card', () => ({
  buildInviteCard: jest.fn().mockResolvedValue(new Uint8Array([1])),
}));

describe('InvitesService permanent invites', () => {
  const invite = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    fields: { maxUses: 'maxUses' },
  };
  const community = { findUnique: jest.fn() };
  const prisma = { invite, community };
  const communities = { roleOf: jest.fn() };
  const service = new InvitesService(
    prisma as unknown as PrismaService,
    communities as unknown as CommunitiesService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    communities.roleOf.mockResolvedValue('member');
  });

  it('creates a permanent invite with a 100-character code and no limits', async () => {
    invite.findFirst.mockResolvedValue(null);
    invite.create.mockImplementation(({ data }) => ({ ...data, uses: 0 }));

    await service.createPermanent(1, 3);

    const { data } = invite.create.mock.calls[0][0];
    expect(data.code).toMatch(/^[A-Za-z0-9]{100}$/);
    expect(data).toMatchObject({
      communityId: 3,
      creatorId: 1,
      permanent: true,
    });
    expect(data.expiresAt).toBeUndefined();
    expect(data.maxUses).toBeUndefined();
  });

  it('reuses the permanent invite the member already has', async () => {
    invite.findFirst.mockResolvedValue({ code: 'existing', permanent: true });

    const result = await service.createPermanent(1, 3);

    expect(result).toEqual({ code: 'existing', permanent: true });
    expect(invite.create).not.toHaveBeenCalled();
  });

  it('refuses to delete a permanent invite', async () => {
    invite.findFirst.mockResolvedValue({
      id: 9,
      creatorId: 1,
      permanent: true,
    });

    await expect(service.revoke(1, 3, 'x'.repeat(100))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(invite.delete).not.toHaveBeenCalled();
  });

  it('disables and enables a permanent invite without changing its code', async () => {
    invite.findFirst.mockResolvedValue({ id: 9, creatorId: 1 });
    invite.update.mockImplementation(({ data }) => ({ code: 'c', ...data }));

    await service.setEnabled(1, 3, 'c', false);
    expect(invite.update.mock.calls[0][0].data.disabledAt).toBeInstanceOf(Date);

    await service.setEnabled(1, 3, 'c', true);
    expect(invite.update.mock.calls[1][0].data).toEqual({ disabledAt: null });
    expect(invite.update.mock.calls[1][0].where).toEqual({ id: 9 });
  });

  it('only finds permanent invites when toggling', async () => {
    invite.findFirst.mockResolvedValue(null);

    await expect(
      service.setEnabled(1, 3, 'nope', false),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(invite.findFirst.mock.calls[0][0].where).toMatchObject({
      code: 'nope',
      communityId: 3,
      permanent: true,
    });
  });

  it('treats a disabled invite as unusable', async () => {
    invite.findFirst.mockResolvedValue(null);

    await expect(service.preview('anything')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const where = invite.findFirst.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([{ disabledAt: null }]));
  });

  it('builds the invite card with the member’s permanent QR', async () => {
    const previousWebUrl = process.env.WEB_URL;
    process.env.WEB_URL = 'https://orbis.example.com';
    invite.findFirst.mockResolvedValue({ code: 'qr', disabledAt: null });
    community.findUnique.mockResolvedValue({
      name: 'Anime Club',
      iconUrl: null,
      coverUrl: 'https://media.example.com/cover.webp',
      backgroundUrl: null,
    });

    await service.card(1, 3);

    expect(community.findUnique.mock.calls[0][0].where).toEqual({ id: 3 });
    expect(buildInviteCard).toHaveBeenCalledWith({
      name: 'Anime Club',
      iconUrl: null,
      coverUrl: 'https://media.example.com/cover.webp',
      backgroundUrl: null,
      qrUrl: 'https://orbis.example.com/qr/qr',
    });
    process.env.WEB_URL = previousWebUrl;
  });

  it('refuses to build the card while the QR is off', async () => {
    invite.findFirst.mockResolvedValue({ code: 'qr', disabledAt: new Date() });

    await expect(service.card(1, 3)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(buildInviteCard).not.toHaveBeenCalled();
  });
});
