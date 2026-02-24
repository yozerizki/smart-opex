import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { PrismaService } from '../prisma/prisma.service'
import { OcrReceiptJob } from './ocr.types'
import { OcrRunnerService } from './ocr.runner.service'
import { OcrStatusService } from './ocr-status.service'

@Processor('ocr')
export class OcrProcessor extends WorkerHost {
  constructor(
    private readonly runner: OcrRunnerService,
    private readonly prisma: PrismaService,
    private readonly statusService: OcrStatusService,
  ) {
    super()
  }

  async process(job: Job<OcrReceiptJob>) {
    const { receiptId, opexItemId, filePath, documentId } = job.data
    let detected: number | null = null
    let rawText: string | undefined
    let confidence: number | undefined

    try {
      const result = await this.runner.runReceiptOcr(filePath)
      detected = Number.isFinite(result.amount) ? Number(result.amount) : 0
      rawText = result.rawText
      confidence = result.confidence
    } catch (err) {
      console.error('OCR failed', err)
    }

    try {
      await this.prisma.opex_receipts.update({
        where: { id: receiptId },
        data: { 
          ocr_detected_total: detected,
        },
      })
    } catch (err) {
      console.warn(`Receipt ${receiptId} no longer exists; skipping OCR update`)
      return { receiptId, detected, skipped: true }
    }

    const document = await this.prisma.documents.findUnique({ where: { id: documentId } })
    if (document) {
      await this.prisma.ocr_results.deleteMany({ where: { document_id: documentId } })
      await this.prisma.ocr_results.create({
        data: {
          document_id: documentId,
          extracted_text: rawText || null,
          parsed_amount: detected,
          parsed_date: null,
          confidence_score: Number.isFinite(confidence) ? Number(confidence) : null,
        },
      })
    }

    await this.statusService.recomputeOpexStatus(opexItemId)

    return { receiptId, detected }
  }
}
