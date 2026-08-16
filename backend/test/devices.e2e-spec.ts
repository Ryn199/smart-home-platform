import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { DeviceType } from '@prisma/client';

describe('Devices (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let jwtToken = '';
  let homeId: number;
  let roomId: number;
  let deviceId: number;

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
        name: 'Device Admin',
        email: 'deviceadmin@example.com',
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
          email: 'deviceadmin@example.com',
          password: 'password123',
        },
      });
      jwtToken = JSON.parse(loginRes.payload).accessToken;
    }

    // Create a home and room for devices testing
    const homeRes = await app.inject({
      method: 'POST',
      url: '/api/homes',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { name: 'Device Test Home' },
    });
    homeId = JSON.parse(homeRes.payload).id;

    const roomRes = await app.inject({
      method: 'POST',
      url: `/api/homes/${homeId}/rooms`,
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { name: 'Device Test Room' },
    });
    roomId = JSON.parse(roomRes.payload).id;
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: 'deviceadmin@example.com' },
      });
      if (homeId) {
        await prisma.home.deleteMany({ where: { id: homeId } });
      }
    } catch {
      // ignore
    }
    await app.close();
  });

  it('POST /api/devices without auth should return 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/devices',
      payload: {
        roomId,
        name: 'Front Door',
        deviceUid: 'door-e2e-001',
        deviceType: DeviceType.SMART_DOOR,
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('POST /api/devices with auth should create a device', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: {
        roomId,
        name: 'Front Door Lock',
        deviceUid: 'door-e2e-001',
        deviceType: DeviceType.SMART_DOOR,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe('Front Door Lock');
    expect(body.deviceUid).toBe('door-e2e-001');
    expect(body.deviceType).toBe('SMART_DOOR');
    expect(body.roomId).toBe(roomId);
    deviceId = body.id;
  });

  it('POST /api/devices with duplicate deviceUid should return 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: {
        roomId,
        name: 'Another Door Lock',
        deviceUid: 'door-e2e-001',
        deviceType: DeviceType.SMART_DOOR,
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it('POST /api/devices with non-existent roomId should return 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: {
        roomId: 99999,
        name: 'Ghost Device',
        deviceUid: 'ghost-001',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('GET /api/devices should return all devices', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices',
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((d: { id: number }) => d.id === deviceId)).toBe(true);
  });

  it('GET /api/devices?deviceType=SMART_DOOR should filter by deviceType', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices?deviceType=SMART_DOOR',
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.every((d: { deviceType: string }) => d.deviceType === 'SMART_DOOR')).toBe(true);
  });

  it('GET /api/devices/:id should return device detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${deviceId}`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(deviceId);
    expect(body.deviceUid).toBe('door-e2e-001');
  });

  it('GET /api/rooms/:roomId/devices should return devices in room', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/rooms/${roomId}/devices`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((d: { id: number }) => d.id === deviceId)).toBe(true);
  });

  it('PATCH /api/devices/:id should update device', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/devices/${deviceId}`,
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { name: 'Main Front Door Lock' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe('Main Front Door Lock');
  });

  it('GET /api/devices/:id/presence should return calculated presence info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${deviceId}/presence`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(deviceId);
    expect(body.deviceUid).toBe('door-e2e-001');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('thresholdSeconds');
  });

  it('POST /api/devices/:id/commands should execute command and publish MQTT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/devices/${deviceId}/commands`,
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { action: 'unlock' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.deviceId).toBe(deviceId);
    expect(body.command).toBe('unlock');
    expect(body.status).toBe('SENT');
  });

  it('POST /api/devices/:id/commands with invalid action should return 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/devices/${deviceId}/commands`,
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { action: 'invalid_door_action' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('GET /api/devices/:id/commands should return command history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/devices/${deviceId}/commands`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].command).toBe('unlock');
  });

  it('DELETE /api/devices/:id should delete device', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/devices/${deviceId}`,
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    expect(res.statusCode).toBe(200);
  });
});
