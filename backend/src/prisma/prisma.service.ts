import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect()
  }
  async enableShutdownHooks() {
    ;(this as any).$on('beforeExit', async () => {
      await this.$disconnect()
    })
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
