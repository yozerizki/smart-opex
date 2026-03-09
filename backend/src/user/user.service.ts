import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  private readonly userInclude = {
    user_profiles: true,
    areas: { include: { regions: true } },
    districts: { include: { areas: { include: { regions: true } } } },
  } as const

  findByEmail(email: string) {
    return this.prisma.users.findUnique({
      where: { email },
      include: this.userInclude,
    })
  }

  findById(id: number) {
    return this.prisma.users.findUnique({
      where: { id },
      include: this.userInclude,
    })
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

  async assertActorCanAssignDistrict(actor: any, districtId: number) {
    const district = await this.findDistrictById(districtId)
    if (!district) return { ok: false, reason: 'Invalid district_id' }

    if (actor.role === 'pusat') return { ok: true, district }
    if (actor.role === 'verifikator' && actor.area_id && district.area_id === actor.area_id) {
      return { ok: true, district }
    }

    return { ok: false, reason: 'District is outside your area' }
  }

  async assertActorCanAssignArea(actor: any, areaId: number) {
    const area = await this.findAreaById(areaId)
    if (!area) return { ok: false, reason: 'Invalid area_id' }

    if (actor.role === 'pusat') return { ok: true, area }
    if (actor.role === 'verifikator' && actor.area_id === areaId) {
      return { ok: true, area }
    }

    return { ok: false, reason: 'Area is outside your scope' }
  }

  findProfileByUserId(userId: number) {
    return this.prisma.user_profiles.findUnique({ where: { user_id: userId } })
  }

  createUser(data: {
    email: string
    passwordHash: string
    role: string
    district_id?: number | null
    area_id?: number | null
  }) {
    return this.prisma.users.create({
      data: {
        email: data.email,
        password_hash: data.passwordHash,
        role: data.role,
        district_id: data.district_id ?? null,
        area_id: data.area_id ?? null,
      },
      include: this.userInclude,
    })
  }

  findAll(actor: any) {
    if (actor.role === 'pusat') {
      return this.prisma.users.findMany({ include: this.userInclude })
    }

    return this.prisma.users.findMany({
      where: {
        OR: [
          { role: 'verifikator', area_id: actor.area_id ?? -1 },
          { role: 'pic', districts: { is: { area_id: actor.area_id ?? -1 } } },
        ],
      },
      include: this.userInclude,
    })
  }

  updateUser(id: number, data: { email?: string; passwordHash?: string; role?: string; district_id?: number | null; area_id?: number | null }) {
    const updateData: any = {}
    if (data.email) updateData.email = data.email
    if (data.passwordHash) updateData.password_hash = data.passwordHash
    if (data.role) updateData.role = data.role
    if (data.district_id !== undefined) updateData.district_id = data.district_id
    if (data.area_id !== undefined) updateData.area_id = data.area_id

    return this.prisma.users.update({ where: { id }, data: updateData, include: this.userInclude })
  }

  removeUser(id: number) {
    return this.prisma.users.delete({ where: { id } })
  }

  upsertProfile(
    userId: number,
    data: {
      full_name?: string
      position?: string
      nip?: string
      phone_number?: string
      nik_ktp?: string
      ktp_scan_path?: string
    },
  ) {
    const updateData: any = {}
    if (data.full_name !== undefined) updateData.full_name = data.full_name
    if (data.position !== undefined) updateData.position = data.position
    if (data.nip !== undefined) updateData.nip = data.nip
    if (data.phone_number !== undefined) updateData.phone_number = data.phone_number
    if (data.nik_ktp !== undefined) updateData.nik_ktp = data.nik_ktp
    if (data.ktp_scan_path !== undefined) updateData.ktp_scan_path = data.ktp_scan_path

    return this.prisma.user_profiles.upsert({
      where: { user_id: userId },
      update: updateData,
      create: {
        user_id: userId,
        full_name: data.full_name || '',
        position: data.position || '',
        nip: data.nip || null,
        phone_number: data.phone_number || '',
        nik_ktp: data.nik_ktp || '',
        ktp_scan_path: data.ktp_scan_path || '',
      },
    })
  }
}
