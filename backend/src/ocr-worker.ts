import { NestFactory } from '@nestjs/core'
import { OcrWorkerModule } from './ocr/ocr.worker.module'

async function bootstrap() {
  await NestFactory.createApplicationContext(OcrWorkerModule)
  console.log('OCR worker started')
}

bootstrap().catch((err) => {
  console.error('Failed to start OCR worker', err)
  process.exit(1)
})
