import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // serve uploaded files from /uploads URL
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })
  // Enable CORS for configured frontend origins
  const configuredOrigins = [
    process.env.FRONTEND_ORIGIN,
    process.env.FRONTEND_ORIGINS,
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
