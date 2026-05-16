import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const httpLogger = new Logger('HTTP');

  app.use(cookieParser());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - started;
      httpLogger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`,
      );
    });
    next();
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  httpLogger.log(`Listening on ${port}`);
}
void bootstrap();
