import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { User } from '@prisma/client';

export type UserWithoutPassword = Omit<User, 'passwordHash'>;

function excludePassword(user: User): UserWithoutPassword {
  const { passwordHash, ...rest } = user;
  void passwordHash;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findById(id: number): Promise<UserWithoutPassword | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return excludePassword(user);
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
      },
    });

    return excludePassword(user);
  }
}
