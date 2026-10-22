import { IsBoolean, IsIn, IsOptional, Matches } from 'class-validator';
import { LibraryStatus, MediaType } from '../../../prisma/generated/client';

export class AddLibraryEntryDto {
  @IsIn(Object.values(MediaType))
  type: MediaType;

  @Matches(/^\d{1,12}$/, { message: 'sourceId must be a number' })
  sourceId: string;

  @IsOptional()
  @IsIn(Object.values(LibraryStatus))
  status?: LibraryStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
