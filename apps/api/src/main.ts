/** API entry point: starts NestJS with cookie auth, validation, security headers and CORS. */
// Load variables from .env into process.env before anything reads them
import 'dotenv/config';
// Required by NestJS decorators / dependency injection
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
// Parses the hp_token login cookie so the JWT strategy can read it
import cookieParser from 'cookie-parser';
// Adds standard security headers (XSS, clickjacking, etc.)
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { checkEnv } from './common/env';

// Builds and starts the HTTP server
async function bootstrap() {
  // Stop immediately if DATABASE_URL / JWT_SECRET etc. are missing or unsafe
  checkEnv();
  // Create the app; rawBody keeps the unparsed body so webhook signatures (Shopify HMAC) can be verified
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Trust the first proxy so rate limiting sees the real client IP
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);
  // Every route lives under /api (e.g. /api/auth/login)
  app.setGlobalPrefix('api');
  // API docs (Swagger UI) are on in development, and in production only when SWAGGER=true
  // Swagger docs are shown in development, and in production only if SWAGGER=true
  const docsOn = process.env.NODE_ENV !== 'production' || process.env.SWAGGER === 'true';
  // Security headers; CSP is relaxed only when the Swagger page is on
  app.use(helmet({ contentSecurityPolicy: docsOn ? false : undefined })); // the Swagger page needs inline scripts
  // Makes req.cookies available
  app.use(cookieParser());
  // Validate and clean every request body using the DTO classes
  app.useGlobalPipes(
    new ValidationPipe({
      // Strip fields that are not declared in the DTO
      whitelist: true,
      // Convert plain JSON into DTO class instances / typed values
      transform: true,
      // one readable message instead of an array
      exceptionFactory: (errs) => new BadRequestException(errs.flatMap((e) => Object.values(e.constraints ?? {}))[0] ?? 'Invalid request'),
    }),
  );
  // Map database errors (duplicate, not found...) to clean 4xx responses
  app.useGlobalFilters(new PrismaExceptionFilter());
  // Allow the web app origin(s) to call the API with cookies (credentials)
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',') ?? true, credentials: true });
  // Build the Swagger/OpenAPI page at /api/docs
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
  // Port from .env, default 4000
  const port = Number(process.env.PORT ?? 4000);
  // Start accepting requests
  await app.listen(port);
  console.log(`Healthy Pots API listening on :${port}/api`);
  if (docsOn) console.log(`API docs: http://localhost:${port}/api/docs`);
}
// Run the startup function
bootstrap();
