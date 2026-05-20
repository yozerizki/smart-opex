import { Module } from '@nestjs/common'
import { BackupRestoreController } from './backup-restore.controller'
import { BackupRestoreService } from './backup-restore.service'

@Module({
  controllers: [BackupRestoreController],
  providers: [BackupRestoreService],
})
export class BackupRestoreModule {}
