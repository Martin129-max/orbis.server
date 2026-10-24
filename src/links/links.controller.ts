import {
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MINUTE, RateLimit } from '../common/throttle';
import { PreviewLinkDto } from './dto/preview-link.dto';
import type { LinkMetadata } from './link-metadata';
import { LinksService } from './links.service';

@Controller('links')
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @RateLimit(60, MINUTE)
  @Get('preview')
  async preview(@Query() { url }: PreviewLinkDto): Promise<LinkMetadata> {
    const preview = await this.linksService.preview(url);
    if (!preview) throw new NotFoundException('No preview for this link');
    return preview;
  }
}
