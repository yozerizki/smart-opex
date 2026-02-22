import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DistrictService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.districts.findMany({ orderBy: { name: 'asc' } })
  }

  create(name: string) {
    return this.prisma.districts.create({ data: { name } })
  }

  update(id: number, name: string) {
    return this.prisma.districts.update({ where: { id }, data: { name } })
  }

  remove(id: number) {
    return this.prisma.districts.delete({ where: { id } })
  }
}
