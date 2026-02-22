import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class GroupViewService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.group_views.findMany({ orderBy: { name: 'asc' } })
  }

  findById(id: number) {
    return this.prisma.group_views.findUnique({ where: { id } })
  }

  create(name: string) {
    return this.prisma.group_views.create({ data: { name } })
  }

  update(id: number, name: string) {
    return this.prisma.group_views.update({ where: { id }, data: { name } })
  }

  remove(id: number) {
    return this.prisma.group_views.delete({ where: { id } })
  }
}
