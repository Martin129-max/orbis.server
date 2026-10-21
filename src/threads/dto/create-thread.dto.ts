import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @MaxLength(300)
  @Matches(/\S/, { message: 'title must not be blank' })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;
}
