import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService, UserWithoutPassword } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthResponse {
  user: UserWithoutPassword;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    const accessToken = this.generateToken(user);

    return {
      user,
      accessToken,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const userWithPassword = await this.usersService.findByEmail(dto.email);
    if (!userWithPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, userWithPassword.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { passwordHash, ...user } = userWithPassword;
    void passwordHash;
    const accessToken = this.generateToken(user);

    return {
      user,
      accessToken,
    };
  }

  async getMe(userId: number): Promise<UserWithoutPassword> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private generateToken(user: UserWithoutPassword): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };
    return this.jwtService.sign(payload);
  }
}
