import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { OcrService } from './ocr.service'
import { OcrStatusService } from './ocr-status.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'ocr',
      connection: process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: Number(process.env.REDIS_PORT || 6379),
          },
    }),
  ],
  providers: [OcrService, OcrStatusService],
  exports: [OcrService, OcrStatusService],
})
export class OcrModule {}
