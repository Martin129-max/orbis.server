import { IsString, MaxLength } from 'class-validator';

export class SearchPeopleDto {
  @IsString()
  @MaxLength(100)
  q: string;
}
