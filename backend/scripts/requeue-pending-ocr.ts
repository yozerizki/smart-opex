import { PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'

type OcrReceiptJob = {
  receiptId: number
  opexItemId: number
  documentId: number
  filePath: string
}

function createConnection() {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL }
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
  }
}

async function main() {
  const prisma = new PrismaClient()
  const queue = new Queue('ocr', { connection: createConnection() })

  try {
    const receipts = await prisma.opex_receipts.findMany({
      where: { ocr_detected_total: null },
      orderBy: { id: 'asc' },
    })

    console.log(`Found ${receipts.length} pending OCR receipts`)

    let retried = 0
    let enqueued = 0
    let skipped = 0

    for (const receipt of receipts) {
      const document = await prisma.documents.findFirst({
        where: {
          opex_item_id: receipt.opex_item_id,
          file_path: receipt.file_path,
        },
        orderBy: { id: 'asc' },
      })

      if (!document) {
        skipped += 1
        console.warn(`Skipping receipt ${receipt.id}: matching document not found`)
        continue
      }

      const jobId = `receipt-${receipt.id}`
      const existingJob = await queue.getJob(jobId)

      if (existingJob) {
        const state = await existingJob.getState()
        if (state === 'failed') {
          await existingJob.retry()
          retried += 1
          console.log(`Retried failed OCR job for receipt ${receipt.id}`)
          continue
        }

        if (state === 'completed') {
          skipped += 1
          console.log(`Skipping receipt ${receipt.id}: existing job already completed`)
          continue
        }

        skipped += 1
        console.log(`Skipping receipt ${receipt.id}: existing job state is ${state}`)
        continue
      }

      const payload: OcrReceiptJob = {
        receiptId: receipt.id,
        opexItemId: receipt.opex_item_id,
        documentId: document.id,
        filePath: receipt.file_path,
      }

      await queue.add('receipt', payload, {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      })

      enqueued += 1
      console.log(`Enqueued OCR job for receipt ${receipt.id}`)
    }

    console.log(`Done. retried=${retried} enqueued=${enqueued} skipped=${skipped}`)
  } finally {
    await queue.close()
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('Failed to requeue pending OCR receipts', err)
  process.exit(1)
})