/** API entry point: starts NestJS with cookie auth, validation, security headers and CORS. */
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { checkEnv } from './common/env';

async function bootstrap() {
  checkEnv();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);
  app.setGlobalPrefix('api');
  // API docs (Swagger UI) are on in development, and in production only when SWAGGER=true
  const docsOn = process.env.NODE_ENV !== 'production' || process.env.SWAGGER === 'true';
  app.use(helmet({ contentSecurityPolicy: docsOn ? false : undefined })); // the Swagger page needs inline scripts
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // one readable message instead of an array
      exceptionFactory: (errs) => new BadRequestException(errs.flatMap((e) => Object.values(e.constraints ?? {}))[0] ?? 'Invalid request'),
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',') ?? true, credentials: true });
  if (docsOn) {
    const config = new DocumentBuilder()
      .setTitle('Healthy Pots API')
      .setDescription('Prepaid meal-subscription platform. Log in with POST /api/auth/login (staff) or /api/auth/otp/verify (customer) in this page: the login cookie is then sent with every "Try it out" call.')
      .setVersion('1.0')
      .addCookieAuth('hp_token')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config), { swaggerOptions: { persistAuthorization: true } });
  }
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`Healthy Pots API listening on :${port}/api`);
  if (docsOn) console.log(`API docs: http://localhost:${port}/api/docs`);
}
bootstrap();
