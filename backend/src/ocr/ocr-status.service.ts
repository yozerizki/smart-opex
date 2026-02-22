import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class OcrStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async recomputeOpexStatus(opexItemId: number) {
    const receipts = await this.prisma.opex_receipts.findMany({
      where: { opex_item_id: opexItemId },
    })

    const sum = receipts.reduce((acc, r) => acc + Number(r.ocr_detected_total || 0), 0)
    const pending = receipts.some((r) => r.ocr_detected_total === null)

    if (pending) {
      return { sum, pending: true }
    }

    const activity = await this.prisma.opex_items.findUnique({ where: { id: opexItemId } })
    if (!activity) {
      return { sum, pending: false }
    }

    if (activity.status === 'TELAH_DIREVIEW') {
      return { sum, pending: false, status: activity.status }
    }

    const manual = Number(activity.amount || 0)
    const equal = Math.abs(sum - manual) < 0.01
    const newStatus = equal ? 'OK' : 'PERLU_REVIEW'

    if (activity.status !== newStatus) {
      await this.prisma.opex_items.update({
        where: { id: opexItemId },
        data: { status: newStatus },
      })
    }

    return { sum, pending: false, status: newStatus }
  }
}
