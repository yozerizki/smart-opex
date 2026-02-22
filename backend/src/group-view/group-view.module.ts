import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { GroupViewController } from './group-view.controller'
import { GroupViewService } from './group-view.service'

@Module({
  imports: [PrismaModule],
  controllers: [GroupViewController],
  providers: [GroupViewService],
  exports: [GroupViewService],
})
export class GroupViewModule {}
