import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
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
}
