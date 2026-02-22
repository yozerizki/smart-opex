import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // serve uploaded files from /uploads URL
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })
  // Enable CORS for local frontend dev server and allow common headers
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5175'
  const allowedOrigins = [frontendOrigin, 'http://localhost:5173', 'http://localhost:3000']
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
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
