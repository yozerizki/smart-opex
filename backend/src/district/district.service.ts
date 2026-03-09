import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DistrictService {
  constructor(private prisma: PrismaService) {}

  findRegions(actor: any) {
    if (actor.role === 'pusat') {
      return this.prisma.regions.findMany({ orderBy: { name: 'asc' } })
    }

    return this.prisma.regions.findMany({
      where: {
        areas: {
          some: {
            id: actor.area_id ?? -1,
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  findAreas(actor: any, regionId?: number) {
    const where: any = {}
    if (regionId) where.region_id = regionId

    if (actor.role !== 'pusat') {
      where.id = actor.area_id ?? -1
    }

    return this.prisma.areas.findMany({
      where,
      include: { regions: true },
      orderBy: { name: 'asc' },
    })
  }

  findAll(actor: any, filters?: { region_id?: number; area_id?: number }) {
    const where: any = {}

    if (filters?.region_id) {
      where.areas = { is: { region_id: filters.region_id } }
    }

    if (filters?.area_id) {
      where.area_id = filters.area_id
    }

    if (actor.role === 'verifikator') {
      where.area_id = actor.area_id ?? -1
    }

    if (actor.role === 'pic') {
      where.id = actor.district_id ?? -1
    }

    return this.prisma.districts.findMany({
      where,
      include: { areas: { include: { regions: true } } },
      orderBy: { name: 'asc' },
    })
  }

  createRegion(name: string) {
    return this.prisma.regions.create({ data: { name } })
  }

  updateRegion(id: number, name: string) {
    return this.prisma.regions.update({ where: { id }, data: { name } })
  }

  removeRegion(id: number) {
    return this.prisma.regions.delete({ where: { id } })
  }

  createArea(region_id: number, name: string) {
    return this.prisma.areas.create({ data: { region_id, name }, include: { regions: true } })
  }

  updateArea(id: number, data: { region_id?: number; name?: string }) {
    return this.prisma.areas.update({ where: { id }, data, include: { regions: true } })
  }

  removeArea(id: number) {
    return this.prisma.areas.delete({ where: { id } })
  }

  async createDistrict(actor: any, name: string, areaId?: number) {
    const resolvedAreaId = actor.role === 'verifikator' ? actor.area_id : areaId
    return this.prisma.districts.create({
      data: {
        name,
        area_id: resolvedAreaId,
      },
      include: { areas: { include: { regions: true } } },
    })
  }

  async updateDistrict(id: number, data: { name?: string; area_id?: number }) {
    return this.prisma.districts.update({
      where: { id },
      data,
      include: { areas: { include: { regions: true } } },
    })
  }

  removeDistrict(id: number) {
    return this.prisma.districts.delete({ where: { id } })
  }

  findDistrictById(id: number) {
    return this.prisma.districts.findUnique({
      where: { id },
      include: { areas: { include: { regions: true } } },
    })
  }

  findAreaById(id: number) {
    return this.prisma.areas.findUnique({
      where: { id },
      include: { regions: true },
    })
  }

  findRegionById(id: number) {
    return this.prisma.regions.findUnique({ where: { id } })
  }
}
