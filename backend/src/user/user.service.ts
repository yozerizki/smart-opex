import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.users.findUnique({
      where: { email },
      include: { user_profiles: true, districts: true },
    })
  }

  findById(id: number) {
    return this.prisma.users.findUnique({
      where: { id },
      include: { user_profiles: true, districts: true },
    })
  }

  findDistrictById(id: number) {
    return this.prisma.districts.findUnique({ where: { id } })
  }

  findProfileByUserId(userId: number) {
    return this.prisma.user_profiles.findUnique({ where: { user_id: userId } })
  }

  createUser(data: {
    email: string
    passwordHash: string
    role: string
    district_id?: number | null
  }) {
    return this.prisma.users.create({
      data: {
        email: data.email,
        password_hash: data.passwordHash,
        role: data.role,
        district_id: data.district_id ?? null,
      },
    })
  }

  findAll() {
    return this.prisma.users.findMany({ include: { user_profiles: true, districts: true } })
  }

  updateUser(id: number, data: { email?: string; passwordHash?: string; role?: string; district_id?: number | null }) {
    const updateData: any = {}
    if (data.email) updateData.email = data.email
    if (data.passwordHash) updateData.password_hash = data.passwordHash
    if (data.role) updateData.role = data.role
    if (data.district_id !== undefined) updateData.district_id = data.district_id

    return this.prisma.users.update({ where: { id }, data: updateData })
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
