import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { normalizeUsername } from '../users/username';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signup(createUserDto: CreateUserDto) {
    if (await this.usersService.findByEmail(createUserDto.email)) {
      throw new ConflictException('Email is already registered');
    }
    if (
      await this.usersService.findByUsername(
        normalizeUsername(createUserDto.username),
      )
    ) {
      throw new ConflictException('Username is already taken');
    }

    const user = await this.usersService.create(createUserDto);

    return this.generateToken(user.id, user.email);
  }

  async login(identifier: string, password: string) {
    const user = identifier.includes('@')
      ? await this.usersService.findByEmail(identifier)
      : await this.usersService.findByUsername(normalizeUsername(identifier));

    if (!user?.password) throw new UnauthorizedException();

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException();

    return this.generateToken(user.id, user.email);
  }

  generateToken(userId: number, email: string) {
    const payload = { sub: userId, email };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
