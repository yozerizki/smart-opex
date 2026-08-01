import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  // serve uploaded files from /uploads URL
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })
  // Enable CORS for configured frontend origins
  const configuredOrigins = [
    configService.get<string>('FRONTEND_ORIGIN'),
    configService.get<string>('FRONTEND_ORIGINS'),
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean))

  const allowAllOrigins = configuredOrigins.includes('*')
  const allowedOrigins = [...configuredOrigins]

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('CORS not allowed'))
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  })

  await app.listen(Number(configService.get<string>('PORT') || 3000));
}
bootstrap();
