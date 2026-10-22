import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LibraryStatus } from '../../../prisma/generated/client';

export class UpdateLibraryEntryDto {
  @IsOptional()
  @IsIn(Object.values(LibraryStatus))
  status?: LibraryStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  progress?: number;
}
