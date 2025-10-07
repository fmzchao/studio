import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(`🚀 ShipSec backend listening on http://${host}:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap ShipSec backend', error);
  process.exit(1);
});
