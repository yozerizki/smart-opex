import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { OcrService } from '../ocr/ocr.service'
import { OcrStatusService } from '../ocr/ocr-status.service'
import { CreateOpexDto } from './dto/create-opex.dto'
import { UpdateOpexDto } from './dto/update-opex.dto'
import * as fs from 'fs'

@Injectable()
export class OpexService {
  constructor(
    private prisma: PrismaService,
    private ocrService: OcrService,
    private ocrStatusService: OcrStatusService,
  ) {}

  private withReceiptTotal(items: any[]) {
    return items.map((i) => {
      const total_ocr = (i.opex_receipts || []).reduce((acc: number, r: any) => acc + Number(r.ocr_detected_total || 0), 0)
      return { ...i, total_ocr }
    })
  }

  create(data: CreateOpexDto) {
    // map domain DTO -> prisma fields: manual_total -> amount
    const createData: any = {
      project_id: data.project_id,
      district_id: (data as any).district_id,
      group_view_id: (data as any).group_view_id,
      item_name: data.item_name,
      recipient_name: (data as any).recipient_name,
      amount: data.manual_total,
      transaction_date: data.transaction_date ? new Date(data.transaction_date) : undefined,
      created_at: new Date(),
    }

    if ((data as any).created_by !== undefined) createData.created_by = (data as any).created_by

    return this.prisma.opex_items.create({ data: createData })
  }

  async addReceipts(opexId: number, files: Express.Multer.File[]) {
    const receipts = [] as any[]
    for (const file of files) {
      const document = await this.prisma.documents.create({
        data: {
          opex_item_id: opexId,
          file_path: file.path,
          file_type: file.mimetype,
        },
      })
      const receipt = await this.prisma.opex_receipts.create({
        data: {
          opex_item_id: opexId,
          file_path: file.path,
          ocr_detected_total: null,
        },
      })
      try {
        await this.ocrService.enqueueReceiptOcr({
          receiptId: receipt.id,
          opexItemId: opexId,
          documentId: document.id,
          filePath: file.path,
        })
      } catch (err) {
        console.error('Failed to enqueue OCR job', err)
      }
      receipts.push({ receipt, document })
    }
    return receipts
  }

  async addDocuments(opexId: number, files: Express.Multer.File[]) {
    const documents = [] as any[]
    for (const file of files) {
      const document = await this.prisma.documents.create({
        data: {
          opex_item_id: opexId,
          file_path: file.path,
          file_type: file.mimetype,
        },
      })
      documents.push(document)
    }
    return documents
  }

  recomputeOcrStatus(opexId: number) {
    return this.ocrStatusService.recomputeOpexStatus(opexId)
  }

  async computeReceiptSum(opexId: number) {
    const res = await this.prisma.opex_receipts.aggregate({
      where: { opex_item_id: opexId },
      _sum: { ocr_detected_total: true },
    })
    return Number(res._sum.ocr_detected_total || 0)
  }

  countReceipts(opexId: number) {
    return this.prisma.opex_receipts.count({ where: { opex_item_id: opexId } })
  }

  async deleteReceipt(opexId: number, receiptId: number) {
    const receipt = await this.prisma.opex_receipts.findUnique({ where: { id: receiptId } })
    if (!receipt || receipt.opex_item_id !== opexId) return null
    const documents = await this.prisma.documents.findMany({
      where: { opex_item_id: opexId, file_path: receipt.file_path },
      select: { id: true },
    })
    if (documents.length) {
      const documentIds = documents.map((doc) => doc.id)
      await this.prisma.ocr_results.deleteMany({ where: { document_id: { in: documentIds } } })
      await this.prisma.documents.deleteMany({ where: { id: { in: documentIds } } })
    }
    return this.prisma.opex_receipts.delete({ where: { id: receiptId } })
  }

  async getReview(id: number) {
    const activity = await this.prisma.opex_items.findUnique({
      where: { id },
      include: {
        opex_receipts: true,
        districts: true,
        group_views: true,
      },
    })

    if (!activity) return null

    const receipts = activity.opex_receipts.map((r) => ({
      id: r.id,
      file_path: r.file_path,
      ocr_detected_total: r.ocr_detected_total,
    }))
    const totalOcr = receipts.reduce((acc, r) => acc + Number(r.ocr_detected_total || 0), 0)

    return {
      id: activity.id,
      item_name: activity.item_name,
      recipient_name: (activity as any).recipient_name,
      manual_total: activity.amount,
      transaction_date: activity.transaction_date ? activity.transaction_date.toISOString().split('T')[0] : null,
      ocr_per_document: receipts,
      total_ocr: totalOcr,
      status: activity.status,
      district_id: activity.district_id,
      districts: activity.districts,
      group_view_id: activity.group_view_id,
      group_views: activity.group_views,
    }
  }

  async exportForUser(userId: number) {
    // fetch user name
    const user = await this.prisma.users.findUnique({ where: { id: userId }, include: { user_profiles: true } })

    // fetch activities for this user
    const activities = await this.prisma.opex_items.findMany({
      where: { created_by: userId },
      include: { opex_receipts: true, group_views: true },
      orderBy: { created_at: 'desc' },
    })

    const picName = user?.user_profiles?.full_name || 'PIC'
    const prNumber = `PR-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const escapeCsv = (value: unknown) => {
      const text = value == null ? '' : String(value)
      if (!/[",\n\r]/.test(text)) return text
      return `"${text.replace(/"/g, '""')}"`
    }

    const rows: Array<Array<string | number>> = []
    rows.push([`PIC: ${picName}`])
    rows.push([`PR Number: ${prNumber}`])
    rows.push([])
    rows.push(['ID', 'Transaction Date', 'Item Name', 'Group View', 'Manual Total', 'Total OCR', 'Status'])

    for (const a of activities) {
      const totalOcr = a.opex_receipts.reduce((acc, r) => acc + Number(r.ocr_detected_total || 0), 0)

      rows.push([
        a.id,
        a.transaction_date ? a.transaction_date.toISOString().split('T')[0] : '',
        a.item_name,
        a.group_views?.name || '',
        a.amount ? Number(a.amount) : 0,
        totalOcr,
        a.status || '',
      ])
    }

    const csv = rows
      .map((row) => row.map((value) => escapeCsv(value)).join(','))
      .join('\n')

    return {
      buffer: Buffer.from(csv, 'utf8'),
      filename: `smart-opex-${userId}-${Date.now()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    }
  }


  findAll() {
    return this.prisma.opex_items.findMany({
      include: { opex_receipts: true, districts: true, group_views: true },
      orderBy: { created_at: 'desc' },
    }).then((items) => this.withReceiptTotal(items))
  }

  findAllByDistrict(districtId: number) {
    return this.prisma.opex_items.findMany({
      where: { district_id: districtId },
      include: { opex_receipts: true, districts: true, group_views: true },
      orderBy: { created_at: 'desc' },
    }).then((items) => this.withReceiptTotal(items))
  }

  findAllWithOptionalDistrict(districtId?: number) {
    return this.prisma.opex_items.findMany({
      where: districtId ? { district_id: districtId } : undefined,
      include: { opex_receipts: true, districts: true, group_views: true },
      orderBy: { created_at: 'desc' },
    }).then((items) => this.withReceiptTotal(items))
  }

  findOne(id: number) {
    return this.prisma.opex_items.findUnique({
      where: { id },
      include: {
        opex_receipts: true,
        documents: {
          where: {
            OR: [
              { file_path: { contains: 'uploads/documents' } },
              { file_path: { contains: '/uploads/documents' } },
            ],
          },
        },
        users: true,
        districts: true,
        group_views: true,
      },
    }).then((item) => {
      if (!item) return null
      const total_ocr = (item.opex_receipts || []).reduce((acc: number, r: any) => acc + Number(r.ocr_detected_total || 0), 0)
      return { ...item, total_ocr }
    })
  }

  async deleteDocument(opexId: number, documentId: number) {
    const document = await this.prisma.documents.findUnique({ where: { id: documentId } })
    if (!document || document.opex_item_id !== opexId) return null

    await this.prisma.ocr_results.deleteMany({ where: { document_id: documentId } })

    if (document.file_path && document.file_path.includes('/uploads/documents') && fs.existsSync(document.file_path)) {
      try {
        await fs.promises.unlink(document.file_path)
      } catch {
        // ignore file unlink failure
      }
    }

    return this.prisma.documents.delete({ where: { id: documentId } })
  }

  async update(id: number, data: UpdateOpexDto) {
    const updateData: any = {}
    if ((data as any).project_id !== undefined) updateData.project_id = (data as any).project_id
    if ((data as any).district_id !== undefined) updateData.district_id = (data as any).district_id
    if ((data as any).group_view_id !== undefined) updateData.group_view_id = (data as any).group_view_id
    if ((data as any).item_name !== undefined) updateData.item_name = (data as any).item_name
    if ((data as any).recipient_name !== undefined) updateData.recipient_name = (data as any).recipient_name
    if ((data as any).manual_total !== undefined) updateData.amount = (data as any).manual_total
    if ((data as any).transaction_date !== undefined) updateData.transaction_date = (data as any).transaction_date ? new Date((data as any).transaction_date) : undefined
    if ((data as any).status !== undefined) updateData.status = (data as any).status

    // perform update
    const updated = await this.prisma.opex_items.update({ where: { id }, data: updateData })

    // If the client explicitly provided a status (e.g. marking as TELAH_DIREVIEW),
    // return the updated record and skip recomputing OCR-based status.
    if ((data as any).status !== undefined) {
      return this.prisma.opex_items.findUnique({
        where: { id },
        include: { opex_receipts: true, districts: true, group_views: true },
      })
    }

    // after update, recompute OCR sum and update status accordingly
    const ocrSum = await this.computeReceiptSum(id)
    const manual = Number(updated.amount || 0)
    console.log('[OPEX][update] id=', id, 'ocrSum=', ocrSum, 'manual=', manual, 'prevStatus=', updated.status)
    const equal = Math.abs(ocrSum - manual) < 0.01
    // If the client updated the manual total, prefer marking as TELAH_DIREVIEW
    // when it now matches OCR. OCR-originated matches (e.g. from addDocument)
    // will still set status to OK.
    const manualUpdated = (data as any).manual_total !== undefined
    const newStatus = equal ? (manualUpdated ? 'TELAH_DIREVIEW' : 'OK') : 'PERLU_REVIEW'
    console.log('[OPEX][update] computed newStatus=', newStatus)
    if ((updated.status || '') !== newStatus) {
      await this.prisma.opex_items.update({ where: { id }, data: { status: newStatus } })
      // return fresh record with new status
      return this.prisma.opex_items.findUnique({
        where: { id },
        include: { opex_receipts: true, districts: true, group_views: true },
      })
    }

    return updated
  }

  remove(id: number) {
    return this.prisma.opex_items.delete({ where: { id } })
  }
}
