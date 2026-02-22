import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { OcrModule } from './ocr.module'
import { OcrProcessor } from './ocr.processor'
import { OcrRunnerService } from './ocr.runner.service'

@Module({
  imports: [PrismaModule, OcrModule],
  providers: [OcrProcessor, OcrRunnerService],
})
export class OcrWorkerModule {}
