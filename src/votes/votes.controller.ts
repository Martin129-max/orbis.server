import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { VoteResult, VotesService } from './votes.service';
import { VoteDto } from './dto/vote.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('votes')
@UseGuards(JwtAuthGuard)
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Put()
  vote(@Req() req, @Body() voteDto: VoteDto): Promise<VoteResult> {
    return this.votesService.vote(req.user.userId, voteDto);
  }
}
