import { Controller, Get, Header } from '@nestjs/common';
import { CommunitiesService } from './communities.service';

@Controller('public/communities')
export class PublicCommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  findPublic() {
    return this.communitiesService.findPublic();
  }
}
