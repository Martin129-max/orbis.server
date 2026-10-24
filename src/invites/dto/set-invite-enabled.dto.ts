import { IsBoolean } from 'class-validator';

export class SetInviteEnabledDto {
  @IsBoolean()
  enabled: boolean;
}
