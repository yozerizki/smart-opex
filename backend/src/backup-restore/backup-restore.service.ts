import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const BACKUP_DIR_NAME = 'backups'
const BACKUP_FILENAME = 'smartopex-backup.tar.gz'
const BACKUP_JSON_FILENAME = 'backup-data.json'
const SAFE_TABLE_NAME = /^[a-z_]+$/

type DatabaseProvider = 'postgresql' | 'sqlserver'

@Injectable()
export class BackupRestoreService {
  constructor(private readonly prisma: PrismaService) {}

  private get uploadsRootPath() {
    return join(process.cwd(), 'uploads')
  }

  private get backupDirPath() {
    return join(this.uploadsRootPath, BACKUP_DIR_NAME)
  }

  private get backupFilePath() {
    return join(this.backupDirPath, BACKUP_FILENAME)
  }

  async getBackupStatus() {
    const exists = fs.existsSync(this.backupFilePath)
    if (!exists) {
      return {
        hasBackup: false,
        fileName: BACKUP_FILENAME,
        sizeBytes: 0,
        updatedAt: null,
      }
    }

    const stat = fs.statSync(this.backupFilePath)
    return {
      hasBackup: true,
      fileName: BACKUP_FILENAME,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    }
  }

  async getExistingBackupArchive() {
    if (!fs.existsSync(this.backupFilePath)) {
      throw new BadRequestException('File backup belum tersedia')
    }

    const stat = fs.statSync(this.backupFilePath)
    const timestamp = stat.mtime.toISOString().replace(/[.:]/g, '-')

    return {
      filePath: this.backupFilePath,
      downloadName: `smartopex-backup-${timestamp}.tar.gz`,
    }
  }

  async createBackupArchive() {
    fs.mkdirSync(this.uploadsRootPath, { recursive: true })
    fs.mkdirSync(this.backupDirPath, { recursive: true })

    const tempFolder = fs.mkdtempSync(join(tmpdir(), 'smartopex-backup-'))
    const backupJsonPath = join(tempFolder, BACKUP_JSON_FILENAME)

    try {
      const backupPayload = {
        version: 1,
        createdAt: new Date().toISOString(),
        data: {
          group_views: await this.prisma.group_views.findMany({ orderBy: { id: 'asc' } }),
          regions: await this.prisma.regions.findMany({ orderBy: { id: 'asc' } }),
          areas: await this.prisma.areas.findMany({ orderBy: { id: 'asc' } }),
          districts: await this.prisma.districts.findMany({ orderBy: { id: 'asc' } }),
          users: await this.prisma.users.findMany({ orderBy: { id: 'asc' } }),
          user_profiles: await this.prisma.user_profiles.findMany({ orderBy: { id: 'asc' } }),
          opex_projects: await this.prisma.opex_projects.findMany({ orderBy: { id: 'asc' } }),
          opex_items: await this.prisma.opex_items.findMany({ orderBy: { id: 'asc' } }),
          documents: await this.prisma.documents.findMany({ orderBy: { id: 'asc' } }),
          ocr_results: await this.prisma.ocr_results.findMany({ orderBy: { id: 'asc' } }),
          opex_receipts: await this.prisma.opex_receipts.findMany({ orderBy: { id: 'asc' } }),
          audit_logs: await this.prisma.audit_logs.findMany({ orderBy: { id: 'asc' } }),
        },
      }

      fs.writeFileSync(backupJsonPath, JSON.stringify(backupPayload), 'utf8')

      this.runTar([
        '--exclude=uploads/backups',
        '-czf',
        this.backupFilePath,
        '-C',
        process.cwd(),
        'uploads',
        '-C',
        tempFolder,
        BACKUP_JSON_FILENAME,
      ])

      const timestamp = new Date().toISOString().replace(/[.:]/g, '-')
      return {
        filePath: this.backupFilePath,
        downloadName: `smartopex-backup-${timestamp}.tar.gz`,
      }
    } catch (error) {
      throw new InternalServerErrorException('Gagal membuat file backup')
    } finally {
      fs.rmSync(tempFolder, { recursive: true, force: true })
    }
  }

  async restoreFromArchive() {
    if (!fs.existsSync(this.backupFilePath)) {
      throw new BadRequestException('File backup belum tersedia')
    }

    return this.restoreFromArchiveFile(this.backupFilePath)
  }

  async restoreFromUploadedArchive(uploadedArchivePath: string) {
    if (!uploadedArchivePath || !fs.existsSync(uploadedArchivePath)) {
      throw new BadRequestException('File upload backup tidak tersedia')
    }

    return this.restoreFromArchiveFile(uploadedArchivePath)
  }

  private async restoreFromArchiveFile(archiveFilePath: string) {
    const tempFolder = fs.mkdtempSync(join(tmpdir(), `smartopex-restore-${randomUUID()}-`))

    try {
      this.runTar(['-xzf', archiveFilePath, '-C', tempFolder])

      const backupJsonPath = join(tempFolder, BACKUP_JSON_FILENAME)
      if (!fs.existsSync(backupJsonPath)) {
        throw new BadRequestException('Format backup tidak valid')
      }

      const parsed = JSON.parse(fs.readFileSync(backupJsonPath, 'utf8'))
      const data = parsed?.data
      if (!data || typeof data !== 'object') {
        throw new BadRequestException('Isi backup tidak valid')
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.audit_logs.deleteMany({})
        await tx.ocr_results.deleteMany({})
        await tx.documents.deleteMany({})
        await tx.opex_receipts.deleteMany({})
        await tx.opex_items.deleteMany({})
        await tx.opex_projects.deleteMany({})
        await tx.user_profiles.deleteMany({})
        await tx.users.deleteMany({})
        await tx.districts.deleteMany({})
        await tx.areas.deleteMany({})
        await tx.regions.deleteMany({})
        await tx.group_views.deleteMany({})

        if (Array.isArray(data.group_views) && data.group_views.length > 0) {
          await tx.group_views.createMany({ data: data.group_views })
        }
        if (Array.isArray(data.regions) && data.regions.length > 0) {
          await tx.regions.createMany({ data: data.regions })
        }
        if (Array.isArray(data.areas) && data.areas.length > 0) {
          await tx.areas.createMany({ data: data.areas })
        }
        if (Array.isArray(data.districts) && data.districts.length > 0) {
          await tx.districts.createMany({ data: data.districts })
        }
        if (Array.isArray(data.users) && data.users.length > 0) {
          await tx.users.createMany({ data: data.users })
        }
        if (Array.isArray(data.user_profiles) && data.user_profiles.length > 0) {
          await tx.user_profiles.createMany({ data: data.user_profiles })
        }
        if (Array.isArray(data.opex_projects) && data.opex_projects.length > 0) {
          await tx.opex_projects.createMany({ data: data.opex_projects })
        }
        if (Array.isArray(data.opex_items) && data.opex_items.length > 0) {
          await tx.opex_items.createMany({ data: data.opex_items })
        }
        if (Array.isArray(data.documents) && data.documents.length > 0) {
          await tx.documents.createMany({ data: data.documents })
        }
        if (Array.isArray(data.ocr_results) && data.ocr_results.length > 0) {
          await tx.ocr_results.createMany({ data: data.ocr_results })
        }
        if (Array.isArray(data.opex_receipts) && data.opex_receipts.length > 0) {
          await tx.opex_receipts.createMany({ data: data.opex_receipts })
        }
        if (Array.isArray(data.audit_logs) && data.audit_logs.length > 0) {
          await tx.audit_logs.createMany({ data: data.audit_logs })
        }

        await this.resetSequence(tx, 'group_views')
        await this.resetSequence(tx, 'regions')
        await this.resetSequence(tx, 'areas')
        await this.resetSequence(tx, 'districts')
        await this.resetSequence(tx, 'users')
        await this.resetSequence(tx, 'user_profiles')
        await this.resetSequence(tx, 'opex_projects')
        await this.resetSequence(tx, 'opex_items')
        await this.resetSequence(tx, 'documents')
        await this.resetSequence(tx, 'ocr_results')
        await this.resetSequence(tx, 'opex_receipts')
        await this.resetSequence(tx, 'audit_logs')
      })

      this.restoreUploadsFromExtractedFolder(join(tempFolder, 'uploads'))

      return {
        success: true,
        message: 'Restore berhasil',
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new InternalServerErrorException('Gagal melakukan restore')
    } finally {
      fs.rmSync(tempFolder, { recursive: true, force: true })
    }
  }

  private restoreUploadsFromExtractedFolder(extractedUploadsPath: string) {
    fs.mkdirSync(this.uploadsRootPath, { recursive: true })

    for (const entry of fs.readdirSync(this.uploadsRootPath)) {
      if (entry === BACKUP_DIR_NAME) continue
      fs.rmSync(join(this.uploadsRootPath, entry), { recursive: true, force: true })
    }

    if (!fs.existsSync(extractedUploadsPath)) return

    for (const entry of fs.readdirSync(extractedUploadsPath)) {
      if (entry === BACKUP_DIR_NAME) continue
      fs.cpSync(join(extractedUploadsPath, entry), join(this.uploadsRootPath, entry), {
        recursive: true,
      })
    }
  }

  private async resetSequence(tx: any, tableName: string) {
    if (!SAFE_TABLE_NAME.test(tableName)) {
      throw new InternalServerErrorException(`Nama tabel tidak valid: ${tableName}`)
    }

    const provider = this.getDatabaseProvider()

    if (provider === 'sqlserver') {
      await tx.$executeRawUnsafe(
        `DECLARE @maxId BIGINT;
         SELECT @maxId = ISNULL(MAX([id]), 0) FROM [${tableName}];
         DBCC CHECKIDENT ('${tableName}', RESEED, @maxId);`,
      )
      return
    }

    await tx.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), (SELECT COUNT(*) > 0 FROM "${tableName}"));`,
    )
  }

  private getDatabaseProvider(): DatabaseProvider {
    const databaseUrl = process.env.DATABASE_URL || ''
    if (databaseUrl.startsWith('sqlserver://')) {
      return 'sqlserver'
    }
    return 'postgresql'
  }

  private runTar(args: string[]) {
    try {
      execFileSync('tar', args, { stdio: 'pipe' })
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new InternalServerErrorException('Binary tar tidak ditemukan di server. Install tar dan pastikan tersedia di PATH.')
      }
      throw error
    }
  }
}
