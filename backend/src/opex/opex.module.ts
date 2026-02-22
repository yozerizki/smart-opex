import { Module } from '@nestjs/common'
import { OpexService } from './opex.service'
import { OpexController } from './opex.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { UserModule } from '../user/user.module'
import { GroupViewModule } from '../group-view/group-view.module'
import { OcrModule } from '../ocr/ocr.module'

@Module({
  imports: [PrismaModule, UserModule, GroupViewModule, OcrModule],
  providers: [OpexService],
  controllers: [OpexController],
})
export class OpexModule {}
