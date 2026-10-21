import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { USERNAME_MESSAGE, USERNAME_PATTERN } from '../username';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}
