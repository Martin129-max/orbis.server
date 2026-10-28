import { IsBoolean } from 'class-validator';

export class UpdateLibraryUpdatesDto {
  @IsBoolean()
  show: boolean;
}
