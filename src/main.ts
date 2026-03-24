import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  if (!(global as any).crypto) {
    (global as any).crypto = { randomUUID };
  }

  dotenv.config();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ any type ishlatish - eng oddiy yechim
  app.enableCors({
    origin: 'https://diamond-academy-phi.vercel.app',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Diamond Academy API')
    .setDescription('Auth va Test tizimi')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('diamond_academy', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Server is running on port ${process.env.PORT ?? 3000}`);
}

bootstrap();