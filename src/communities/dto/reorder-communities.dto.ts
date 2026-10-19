import { ArrayMaxSize, IsArray, IsInt } from 'class-validator';

export class ReorderCommunitiesDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  communityIds: number[];
}
