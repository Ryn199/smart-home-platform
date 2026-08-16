import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Homes & Rooms (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let jwtToken = '';
  let homeId: number;
  let roomId: number;

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

    // Register a user to obtain auth token
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Home Admin',
        email: 'homeadmin@example.com',
        password: 'password123',
      },
    });

    if (regRes.statusCode === 201) {
      jwtToken = JSON.parse(regRes.payload).accessToken;
    } else {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'homeadmin@example.com',
          password: 'password123',
        },
      });
      jwtToken = JSON.parse(loginRes.payload).accessToken;
    }
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: 'homeadmin@example.com' },
      });
    } catch {
      // ignore
    }
    await app.close();
  });

  describe('Homes Endpoints', () => {
    it('POST /api/homes without auth should return 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/homes',
        payload: { name: 'Unauthorized Home' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('POST /api/homes with auth should create a home', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/homes',
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { name: 'Villa Smart', address: 'Sunset Blvd 101' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.name).toBe('Villa Smart');
      expect(body.address).toBe('Sunset Blvd 101');
      homeId = body.id;
    });

    it('GET /api/homes should return list of homes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/homes',
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((h: { id: number }) => h.id === homeId)).toBe(true);
    });

    it('GET /api/homes/:id should return home detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/homes/${homeId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(homeId);
      expect(body.name).toBe('Villa Smart');
    });

    it('PATCH /api/homes/:id should update home', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/homes/${homeId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { name: 'Villa Smart Updated' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.name).toBe('Villa Smart Updated');
    });
  });

  describe('Rooms Endpoints', () => {
    it('POST /api/homes/:homeId/rooms should create a room in the home', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/homes/${homeId}/rooms`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { name: 'Living Room' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.name).toBe('Living Room');
      expect(body.homeId).toBe(homeId);
      roomId = body.id;
    });

    it('POST /api/homes/99999/rooms should return 404 for non-existent home', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/homes/99999/rooms',
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { name: 'Ghost Room' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('GET /api/homes/:homeId/rooms should return rooms in home', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/homes/${homeId}/rooms`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((r: { id: number }) => r.id === roomId)).toBe(true);
    });

    it('GET /api/rooms/:id should return room detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/rooms/${roomId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(roomId);
      expect(body.name).toBe('Living Room');
      expect(body.home.id).toBe(homeId);
    });

    it('PATCH /api/rooms/:id should update room name', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/rooms/${roomId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
        payload: { name: 'Master Living Room' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.name).toBe('Master Living Room');
    });

    it('DELETE /api/rooms/:id should delete room', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/rooms/${roomId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('DELETE /api/homes/:id should delete home', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/homes/${homeId}`,
        headers: { authorization: `Bearer ${jwtToken}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
