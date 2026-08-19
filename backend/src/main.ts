import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyHelmet from '@fastify/helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, bodyLimit: 15 * 1024 * 1024 }),
  );

  // Security: Helmet HTTP Headers (with CSP config for Swagger UI)
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
        scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
      },
    },
  });

  // Security: CORS Configuration
  const allowedOrigins = process.env.CORS_ORIGIN ?? '*';
  app.enableCors({
    origin: allowedOrigins === '*' ? true : allowedOrigins.split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global API prefix — all endpoints are under /api
  app.setGlobalPrefix('api');

  // Global validation pipe for all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Smart Home Platform API')
    .setDescription(
      'REST API documentation for Smart Home backend, Flutter mobile client, and Web Admin dashboard.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT Bearer token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'Health check endpoints')
    .addTag('Auth', 'User authentication & profile')
    .addTag('Homes', 'Home management')
    .addTag('Rooms', 'Room management')
    .addTag('Devices', 'Generic device management & commands')
    .addTag('Sensors', 'Custom sensor discovery & historical telemetry')
    .addTag('Automations', 'Automation rules and triggers')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  const host = '0.0.0.0';

  await app.listen(port, host);

  logger.log(`Application is running on: http://${host}:${String(port)}/api`);
  logger.log(`Swagger documentation: http://${host}:${String(port)}/api/docs`);
  logger.log(`Health check: http://${host}:${String(port)}/api/health`);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', err);
  process.exit(1);
});
