import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { SteamSyncService } from './steam-sync.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService, SteamSyncService, PrismaService],
  exports: [SteamSyncService],
})
export class LibraryModule {}
