import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  // Global API prefix — all endpoints are under /api
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  const host = '0.0.0.0';

  await app.listen(port, host);

  logger.log(`Application is running on: http://${host}:${String(port)}/api`);
  logger.log(`Health check: http://${host}:${String(port)}/api/health`);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', err);
  process.exit(1);
});
