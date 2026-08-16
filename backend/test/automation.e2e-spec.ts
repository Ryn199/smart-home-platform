import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Automation (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let jwtToken = '';
  let homeId: number;
  let automationId: number;

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

    // Register a user
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Automation Admin',
        email: 'autoadmin@example.com',
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
          email: 'autoadmin@example.com',
          password: 'password123',
        },
      });
      jwtToken = JSON.parse(loginRes.payload).accessToken;
    }

    // Create Home
    const homeRes = await app.inject({
      method: 'POST',
      url: '/api/homes',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { name: 'Automation Home' },
    });
    homeId = JSON.parse(homeRes.payload).id;
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: 'autoadmin@example.com' },
      });
      if (homeId) {
        await prisma.home.deleteMany({ where: { id: homeId } });
      }
    } catch {
      // ignore
    }
    await app.close();
  });

  it('POST /api/automations without auth should return 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/automations',
      payload: {
        homeId,
        name: 'Auto Fan Rule',
        configuration: {},
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('POST /api/automations with auth should create an automation rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/automations',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: {
        homeId,
        name: 'Temperature Exceeded -> Turn On Fan',
        enabled: true,
        configuration: {
          trigger: {
            type: 'sensor_threshold',
            sensorType: 'temperature',
            operator: '>',
            value: 30,
          },
          action: {
            deviceId: 1,
            action: 'set_speed',
            speed: 2,
          },
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe('Temperature Exceeded -> Turn On Fan');
    expect(body.homeId).toBe(homeId);
    expect(body.enabled).toBe(true);
    automationId = body.id;
  });

  it('GET /api/automations should return all automations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/automations',
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((a: { id: number }) => a.id === automationId)).toBe(true);
  });

  it('GET /api/automations?homeId=... should filter by home', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/automations?homeId=${homeId}`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.every((a: { homeId: number }) => a.homeId === homeId)).toBe(true);
  });

  it('GET /api/automations/:id should return automation detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/automations/${automationId}`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(automationId);
  });

  it('PATCH /api/automations/:id should update automation rule', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/automations/${automationId}`,
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { enabled: false },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.enabled).toBe(false);
  });

  it('DELETE /api/automations/:id should delete automation rule', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/automations/${automationId}`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
  });
});
