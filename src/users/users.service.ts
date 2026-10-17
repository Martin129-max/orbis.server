import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User as UserModel } from '../../prisma/generated/client';

export type PublicUser = Omit<UserModel, 'password'>;

const omitPassword = { password: true } as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: await bcrypt.hash(createUserDto.password, 10),
      },
      omit: omitPassword,
    });
  }

  async findAll(): Promise<PublicUser[]> {
    return this.prisma.user.findMany({ omit: omitPassword });
  }

  async findOne(id: number): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      omit: omitPassword,
    });
  }

  findByEmail(email: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<PublicUser> {
    const data = updateUserDto.password
      ? {
          ...updateUserDto,
          password: await bcrypt.hash(updateUserDto.password, 10),
        }
      : updateUserDto;

    return this.prisma.user.update({
      where: { id },
      data,
      omit: omitPassword,
    });
  }

  async remove(id: number): Promise<PublicUser> {
    return this.prisma.user.delete({
      where: { id },
      omit: omitPassword,
    });
  }
}
