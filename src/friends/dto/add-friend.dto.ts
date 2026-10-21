import { IsEmail, IsInt, Max, Min, ValidateIf } from 'class-validator';

export class AddFriendDto {
  @ValidateIf((dto: AddFriendDto) => dto.email === undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId?: number;

  @ValidateIf((dto: AddFriendDto) => dto.userId === undefined)
  @IsEmail()
  email?: string;
}
