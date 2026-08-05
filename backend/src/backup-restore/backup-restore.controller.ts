import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import type { Response } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import * as fs from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { JwtAuthGuard } from '../auth/jwt-auth-guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { BackupRestoreService } from './backup-restore.service'

@Controller('backup-restore')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('pusat')
export class BackupRestoreController {
  constructor(
    private readonly backupRestoreService: BackupRestoreService,
  ) {}

  @Get('status')
  async status() {
    return this.backupRestoreService.getBackupStatus()
  }

  @Get('download')
  async download(@Res() res: Response) {
    const backup = await this.backupRestoreService.getExistingBackupArchive()

    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Disposition', `attachment; filename="${backup.downloadName}"`)
    res.sendFile(backup.filePath)
  }

  @Post('backup')
  async backup(
    @Req() req: any,
    @Res() res: Response,
  ) {
    const backup = await this.backupRestoreService.createBackupArchive()

    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Disposition', `attachment; filename="${backup.downloadName}"`)
    res.sendFile(backup.filePath)
  }

  @Post('restore')
  async restore(@Req() req: any) {
    return this.backupRestoreService.restoreFromArchive()
  }

  @Post('restore-upload')
  @UseInterceptors(FileInterceptor('file'))
  async restoreFromUpload(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File backup wajib diunggah')
    }

    const fileName = (file.originalname || '').toLowerCase()
    if (!fileName.endsWith('.tar.gz')) {
      throw new BadRequestException('File backup harus berekstensi .tar.gz')
    }

    const tempFilePath = join(tmpdir(), `smartopex-upload-${Date.now()}-${Math.random().toString(16).slice(2)}.tar.gz`)

    try {
      fs.writeFileSync(tempFilePath, file.buffer)
      return await this.backupRestoreService.restoreFromUploadedArchive(tempFilePath)
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.rmSync(tempFilePath, { force: true })
      }
    }
  }
}
