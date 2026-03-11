import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { OcrService } from '../ocr/ocr.service'
import { OcrStatusService } from '../ocr/ocr-status.service'
import { CreateOpexDto } from './dto/create-opex.dto'
import { UpdateOpexDto } from './dto/update-opex.dto'
import * as fs from 'fs'
import * as ExcelJS from 'exceljs'

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

  async exportForUser(
    userId: number,
    filters?: { region_id?: number; area_id?: number; district_id?: number }
  ) {
    // fetch user with both area and district relations
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_profiles: true,
        areas: { include: { regions: true } },
        districts: { include: { areas: { include: { regions: true } } } },
      },
    })

    // build where clause based on role — mirrors controller logic
    const where: any = {}
    if (user?.role === 'pic') {
      if (user.district_id) where.district_id = user.district_id
    } else if (user?.role === 'verifikator') {
      const effectiveAreaId = filters?.area_id ?? user.area_id
      if (filters?.district_id) {
        where.district_id = filters.district_id
      } else if (effectiveAreaId) {
        where.districts = { is: { area_id: effectiveAreaId } }
      }
    } else {
      // pusat: apply only the explicit filters, no created_by restriction
      if (filters?.district_id) where.district_id = filters.district_id
      if (filters?.area_id) where.districts = { is: { area_id: filters.area_id } }
      if (filters?.region_id) {
        const base = where.districts?.is || {}
        where.districts = { is: { ...base, areas: { is: { region_id: filters.region_id } } } }
      }
    }

    const activities = await this.prisma.opex_items.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: {
        opex_receipts: true,
        group_views: true,
        districts: { include: { areas: { include: { regions: true } } } },
      },
      orderBy: { created_at: 'desc' },
    })

    // prepare data
    const picName = user?.user_profiles?.full_name || 'PIC'
    const picArea = (user as any)?.areas?.name || user?.districts?.areas?.name || 'N/A'
    const now = new Date()
    const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(now)
    const year = now.getFullYear()
    const filename = `kuitansi-${userId}-${Date.now()}.xlsx`

    // create workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Sheet1')

    // set column widths
    worksheet.columns = [
      { width: 6 },   // nomor
      { width: 30 },  // Deskripsi transaksi
      { width: 15 },  // Group View
      { width: 25 },  // nama toko
      { width: 12 },  // tanggal
      { width: 18 },  // jumlah
    ]

    // title
    let currentRow = 1
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
    const titleCell = worksheet.getCell(`A${currentRow}`)
    titleCell.value = 'RINCIAN KUITANSI/NOTA SETTLEMENT CASH CARD'
    titleCell.font = { bold: true, size: 12 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    currentRow++

    // subtitle
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
    const subtitleCell = worksheet.getCell(`A${currentRow}`)
    subtitleCell.value = `Dana Operasional PT. Pertamina Gas ${picArea} Bulan ${monthName} ${year}`
    subtitleCell.font = { bold: true, size: 11 }
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    currentRow++

    // lokasi
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
    const lokasiCell = worksheet.getCell(`A${currentRow}`)
    lokasiCell.value = `Lokasi: ${picArea}`
    lokasiCell.font = { italic: true, size: 10 }
    currentRow++

    // empty row
    currentRow++

    // PIC info (left-aligned)
    worksheet.getCell(`A${currentRow}`).value = `Nama : ${picName}`
    currentRow++
    worksheet.getCell(`A${currentRow}`).value = `reff ID :`
    currentRow++
    worksheet.getCell(`A${currentRow}`).value = `no. PR :`
    currentRow++
    worksheet.getCell(`A${currentRow}`).value = `no PO :`
    currentRow++

    // empty row
    currentRow++

    // table header
    const headerRow = currentRow
    worksheet.getCell(`A${headerRow}`).value = 'Nomor'
    worksheet.getCell(`B${headerRow}`).value = 'Deskripsi Transaksi'
    worksheet.getCell(`C${headerRow}`).value = 'Group View'
    worksheet.getCell(`D${headerRow}`).value = 'Nama Toko'
    worksheet.getCell(`E${headerRow}`).value = 'Tanggal'
    worksheet.getCell(`F${headerRow}`).value = 'Jumlah'

    // header styling
    for (let col = 1; col <= 6; col++) {
      const cell = worksheet.getCell(headerRow, col)
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    }
    currentRow++

    // data rows
    activities.forEach((activity, idx) => {
      const dataRow = currentRow + idx
      worksheet.getCell(`A${dataRow}`).value = idx + 1
      worksheet.getCell(`B${dataRow}`).value = activity.item_name || ''
      worksheet.getCell(`C${dataRow}`).value = activity.group_views?.name || ''
      worksheet.getCell(`D${dataRow}`).value = activity.recipient_name || ''
      worksheet.getCell(`E${dataRow}`).value = activity.transaction_date
        ? new Date(activity.transaction_date).toLocaleDateString('id-ID')
        : ''
      worksheet.getCell(`F${dataRow}`).value = Number(activity.amount || 0)

      // align numbers to right
      worksheet.getCell(`F${dataRow}`).alignment = { horizontal: 'right' }
      worksheet.getCell(`F${dataRow}`).numFmt = '#,##0'
    })

    // generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    return {
      buffer: Buffer.from(buffer as any),
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  }


  findAll() {
    return this.prisma.opex_items.findMany({
      include: { opex_receipts: true, districts: { include: { areas: { include: { regions: true } } } }, group_views: true },
      orderBy: { created_at: 'desc' },
    }).then((items) => this.withReceiptTotal(items))
  }

  findAllByDistrict(districtId: number) {
    return this.prisma.opex_items.findMany({
      where: { district_id: districtId },
      include: { opex_receipts: true, districts: { include: { areas: { include: { regions: true } } } }, group_views: true },
      orderBy: { created_at: 'desc' },
    }).then((items) => this.withReceiptTotal(items))
  }

  findAllWithFilters(filters?: { region_id?: number; area_id?: number; district_id?: number }) {
    const where: any = {}
    if (filters?.district_id) where.district_id = filters.district_id
    if (filters?.area_id) where.districts = { is: { area_id: filters.area_id } }
    if (filters?.region_id) {
      const base = where.districts?.is || {}
      where.districts = { is: { ...base, areas: { is: { region_id: filters.region_id } } } }
    }

    return this.prisma.opex_items.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: { opex_receipts: true, districts: { include: { areas: { include: { regions: true } } } }, group_views: true },
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
        districts: { include: { areas: { include: { regions: true } } } },
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
        include: { opex_receipts: true, districts: { include: { areas: { include: { regions: true } } } }, group_views: true },
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
        include: { opex_receipts: true, districts: { include: { areas: { include: { regions: true } } } }, group_views: true },
      })
    }

    return updated
  }

  remove(id: number) {
    return this.prisma.opex_items.delete({ where: { id } })
  }
}
