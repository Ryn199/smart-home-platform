import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { DeviceType } from '@prisma/client';

describe('Custom Sensor Telemetry (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let jwtToken = '';
  let homeId: number;
  let roomId: number;
  let deviceId: number;
  let sensorId: number;

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

    // Register user
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Telemetry User',
        email: 'telemetryuser@example.com',
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
          email: 'telemetryuser@example.com',
          password: 'password123',
        },
      });
      jwtToken = JSON.parse(loginRes.payload).accessToken;
    }

    // Create Home & Room
    const homeRes = await app.inject({
      method: 'POST',
      url: '/api/homes',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { name: 'Telemetry Home' },
    });
    homeId = JSON.parse(homeRes.payload).id;

    const roomRes = await app.inject({
      method: 'POST',
      url: `/api/homes/${homeId}/rooms`,
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { name: 'Sensor Room' },
    });
    roomId = JSON.parse(roomRes.payload).id;

    // Create Device
    const devRes = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: {
        roomId,
        name: 'Living Room Sensor Node',
        deviceUid: 'sensor-e2e-node-01',
        deviceType: DeviceType.CUSTOM_SENSOR,
      },
    });
    deviceId = JSON.parse(devRes.payload).id;

    // Create Sensor & Readings in DB for querying
    const sensor = await prisma.sensor.create({
      data: {
        deviceId,
        type: 'temperature',
        name: 'Temperature',
        unit: '°C',
      },
    });
    sensorId = sensor.id;

    await prisma.sensorReading.createMany({
      data: [
        { sensorId, value: 24.5, recordedAt: new Date('2026-08-16T10:00:00Z') },
        { sensorId, value: 25.0, recordedAt: new Date('2026-08-16T11:00:00Z') },
        { sensorId, value: 26.2, recordedAt: new Date('2026-08-16T12:00:00Z') },
      ],
    });
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: 'telemetryuser@example.com' },
      });
      if (homeId) {
        await prisma.home.deleteMany({ where: { id: homeId } });
      }
    } catch {
      // ignore
    }
    await app.close();
  });

  it('GET /api/devices/:deviceId/sensors without auth should return 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${deviceId}/sensors`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /api/devices/:deviceId/sensors with auth should return sensor list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${deviceId}/sensors`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0]).toHaveProperty('type', 'temperature');
    expect(body[0]).toHaveProperty('readings');
  });

  it('GET /api/sensors/:sensorId should return sensor details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sensors/${sensorId}`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(sensorId);
    expect(body.unit).toBe('°C');
  });

  it('GET /api/sensors/:sensorId/readings should return historical readings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sensors/${sensorId}/readings`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('total');
    expect(body.total).toBe(3);
    expect(Array.isArray(body.readings)).toBe(true);
  });

  it('GET /api/sensors/:sensorId/readings?limit=2 should limit results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sensors/${sensorId}/readings?limit=2`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.readings.length).toBe(2);
  });

  it('GET /api/sensors/:sensorId/readings with date filters should filter accurately', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sensors/${sensorId}/readings?from=2026-08-16T10:30:00Z&to=2026-08-16T12:30:00Z`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.total).toBe(2);
  });

  it('GET /api/sensors/99999/readings should return 404 for non-existent sensor', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sensors/99999/readings',
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
