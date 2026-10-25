import { IsBoolean } from 'class-validator';

export class UpdateConnectionDto {
  @IsBoolean()
  showLive: boolean;
}
