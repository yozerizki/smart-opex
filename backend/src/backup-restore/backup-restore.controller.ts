import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth-guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { BackupRestoreService } from './backup-restore.service'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'

@Controller('backup-restore')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('pusat')
export class BackupRestoreController {
  constructor(
    private readonly backupRestoreService: BackupRestoreService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertPassword(req: any, password: string) {
    if (!password) {
      throw new UnauthorizedException('Password wajib diisi')
    }

    const actorId = req.user?.userId || req.user?.sub
    const actor = await this.prisma.users.findUnique({
      where: { id: actorId },
      select: { password_hash: true, role: true },
    })

    if (!actor || actor.role !== 'pusat') {
      throw new UnauthorizedException('Akses ditolak')
    }

    const ok = await bcrypt.compare(password, actor.password_hash)
    if (!ok) {
      throw new UnauthorizedException('Password tidak valid')
    }
  }

  @Get('status')
  async status() {
    return this.backupRestoreService.getBackupStatus()
  }

  @Post('backup')
  async backup(
    @Req() req: any,
    @Body() body: { password: string },
    @Res() res: Response,
  ) {
    await this.assertPassword(req, body?.password)
    const backup = await this.backupRestoreService.createBackupArchive()

    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Disposition', `attachment; filename="${backup.downloadName}"`)
    res.sendFile(backup.filePath)
  }

  @Post('restore')
  async restore(@Req() req: any, @Body() body: { password: string }) {
    await this.assertPassword(req, body?.password)
    return this.backupRestoreService.restoreFromArchive()
  }
}
