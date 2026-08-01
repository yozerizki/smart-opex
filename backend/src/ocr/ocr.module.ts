import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { OcrService } from './ocr.service'
import { OcrStatusService } from './ocr-status.service'
import { PrismaModule } from '../prisma/prisma.module'
import { OcrEngineController } from './ocr-engine.controller'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    BullModule.registerQueueAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        name: 'ocr',
        connection: configService.get<string>('REDIS_URL')
          ? { url: configService.getOrThrow<string>('REDIS_URL') }
          : {
              host: configService.get<string>('REDIS_HOST') || '127.0.0.1',
              port: Number(configService.get<string>('REDIS_PORT') || 6379),
            },
      }),
    }),
  ],
  providers: [OcrService, OcrStatusService],
  controllers: [OcrEngineController],
  exports: [OcrService, OcrStatusService],
})
export class OcrModule {}
