import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AddLibraryEntryDto } from './dto/add-library-entry.dto';
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto';
import { LibraryService } from './library.service';
import { MediaType } from '../../prisma/generated/client';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('search')
  search(@Req() req, @Query('q') q?: string) {
    return this.libraryService.search(req.user.userId, q);
  }

  @Get('media/:type/:sourceId')
  media(
    @Req() req,
    @Param('type', new ParseEnumPipe(MediaType)) type: MediaType,
    @Param('sourceId') sourceId: string,
  ) {
    return this.libraryService.media(req.user.userId, type, sourceId);
  }

  @Get()
  list(@Req() req) {
    return this.libraryService.list(req.user.userId);
  }

  @Post()
  add(@Req() req, @Body() addLibraryEntryDto: AddLibraryEntryDto) {
    return this.libraryService.add(req.user.userId, addLibraryEntryDto);
  }

  @Patch(':id')
  update(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLibraryEntryDto: UpdateLibraryEntryDto,
  ) {
    return this.libraryService.update(
      req.user.userId,
      id,
      updateLibraryEntryDto,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.libraryService.remove(req.user.userId, id);
  }
}
