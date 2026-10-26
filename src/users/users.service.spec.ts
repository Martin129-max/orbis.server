import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: {} },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('Saving preferences', () => {
  const update = jest.fn();
  const service = new UsersService(
    { user: { update } } as unknown as PrismaService,
    {} as StorageService,
  );

  it('remembers when someone turns off update notes', async () => {
    update.mockResolvedValue({
      id: 1,
      email: 'reader@anime.test',
      isAdmin: false,
      showChangelog: false,
    });

    const profile = await service.updatePreferences(1, {
      showChangelog: false,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ showChangelog: false }),
      }),
    );
    expect(profile).toMatchObject({ showChangelog: false });
  });
});
