import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Clean up test users
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: ['testuser@example.com', 'testuser2@example.com'],
          },
        },
      });
    } catch {
      // ignore in case db connection isn't available
    }
    await app.close();
  });

  const testUser = {
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'password123',
  };

  let jwtToken = '';

  it('POST /api/auth/register should create a user and return JWT', async () => {
    // Ensure clean state
    try {
      await prisma.user.deleteMany({
        where: { email: testUser.email },
      });
    } catch {
      // ignore
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty('accessToken');
    expect(body.user).toHaveProperty('email', testUser.email);
    expect(body.user).not.toHaveProperty('passwordHash');
    jwtToken = body.accessToken;
  });

  it('POST /api/auth/register should fail on duplicate email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser,
    });

    expect(response.statusCode).toBe(409);
  });

  it('POST /api/auth/login should authenticate and return JWT', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty('accessToken');
    expect(body.user.email).toBe(testUser.email);
  });

  it('POST /api/auth/login should reject invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /api/auth/me should return current user when authenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${jwtToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty('email', testUser.email);
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('GET /api/auth/me should fail when unauthenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
  });
});
