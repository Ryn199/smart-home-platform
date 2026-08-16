import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mocked-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a new user and return token', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(result.user.email).toBe('john@example.com');
      expect(usersService.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email is already taken', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 1, email: 'john@example.com' });

      await expect(
        service.register({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should successfully login and return token when credentials match', async () => {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);

      usersService.findByEmail.mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.login({
        email: 'john@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(result.user.email).toBe('john@example.com');
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('different-password', salt);

      usersService.findByEmail.mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash,
      });

      await expect(
        service.login({
          email: 'john@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
