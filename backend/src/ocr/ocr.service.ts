import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { OcrReceiptJob } from './ocr.types'

@Injectable()
export class OcrService {
  constructor(@InjectQueue('ocr') private readonly queue: Queue) {}

  async enqueueReceiptOcr(payload: OcrReceiptJob) {
    return this.queue.add('receipt', payload, {
      jobId: `receipt-${payload.receiptId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    })
  }
}
