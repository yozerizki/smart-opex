import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10)

  const districtArea = await prisma.districts.upsert({
    where: { name: 'Area' },
    update: {},
    create: { name: 'Area' },
  })

  const district1 = await prisma.districts.upsert({
    where: { name: 'District 1' },
    update: {},
    create: { name: 'District 1' },
  })

  const district2 = await prisma.districts.upsert({
    where: { name: 'District 2' },
    update: {},
    create: { name: 'District 2' },
  })

  await prisma.group_views.upsert({
    where: { name: 'Operasional' },
    update: {},
    create: { name: 'Operasional' },
  })

  await prisma.group_views.upsert({
    where: { name: 'Logistik' },
    update: {},
    create: { name: 'Logistik' },
  })

  await prisma.group_views.upsert({
    where: { name: 'Transport' },
    update: {},
    create: { name: 'Transport' },
  })

  const verifikator = await prisma.users.upsert({
    where: { email: 'verifikator@smartopex.local' },
    update: {
      password_hash: passwordHash,
      role: 'verifikator',
    },
    create: {
      email: 'verifikator@smartopex.local',
      password_hash: passwordHash,
      role: 'verifikator',
    },
  })

  await prisma.user_profiles.upsert({
    where: { user_id: verifikator.id },
    update: {
      full_name: 'Verifikator',
      position: 'System Administrator',
      nip: '0000000000',
      phone_number: '081234567890',
      nik_ktp: '0000000000000000',
      ktp_scan_path: 'placeholder/ktp_verifikator.pdf',
    },
    create: {
      user_id: verifikator.id,
      full_name: 'Verifikator',
      position: 'System Administrator',
      nip: '0000000000',
      phone_number: '081234567890',
      nik_ktp: '0000000000000000',
      ktp_scan_path: 'placeholder/ktp_verifikator.pdf',
    },
  })

  console.log('Seed verifikator berhasil')

  // Seed PIC accounts: 1 Area, 2 District
  const picPassword = await bcrypt.hash('picpass123', 10)

  const picArea = await prisma.users.upsert({
    where: { email: 'pic_area@smartopex.local' },
    update: {
      password_hash: picPassword,
      role: 'pic',
      district_id: districtArea.id,
    },
    create: {
      email: 'pic_area@smartopex.local',
      password_hash: picPassword,
      role: 'pic',
      district_id: districtArea.id,
    },
  })

  await prisma.user_profiles.upsert({
    where: { user_id: picArea.id },
    update: {
      full_name: 'PIC Area',
      position: 'PIC Area Office',
      nip: '1111111111',
      phone_number: '081111111111',
      nik_ktp: '1111111111111111',
      ktp_scan_path: 'placeholder/ktp_pic_area.pdf',
    },
    create: {
      user_id: picArea.id,
      full_name: 'PIC Area',
      position: 'PIC Area Office',
      nip: '1111111111',
      phone_number: '081111111111',
      nik_ktp: '1111111111111111',
      ktp_scan_path: 'placeholder/ktp_pic_area.pdf',
    },
  })

  const picDistrict1 = await prisma.users.upsert({
    where: { email: 'pic_district1@smartopex.local' },
    update: {
      password_hash: picPassword,
      role: 'pic',
      district_id: district1.id,
    },
    create: {
      email: 'pic_district1@smartopex.local',
      password_hash: picPassword,
      role: 'pic',
      district_id: district1.id,
    },
  })

  await prisma.user_profiles.upsert({
    where: { user_id: picDistrict1.id },
    update: {
      full_name: 'PIC District 1',
      position: 'PIC District',
      nip: '2222222222',
      phone_number: '082222222222',
      nik_ktp: '2222222222222222',
      ktp_scan_path: 'placeholder/ktp_pic_district1.pdf',
    },
    create: {
      user_id: picDistrict1.id,
      full_name: 'PIC District 1',
      position: 'PIC District',
      nip: '2222222222',
      phone_number: '082222222222',
      nik_ktp: '2222222222222222',
      ktp_scan_path: 'placeholder/ktp_pic_district1.pdf',
    },
  })

  const picDistrict2 = await prisma.users.upsert({
    where: { email: 'pic_district2@smartopex.local' },
    update: {
      password_hash: picPassword,
      role: 'pic',
      district_id: district2.id,
    },
    create: {
      email: 'pic_district2@smartopex.local',
      password_hash: picPassword,
      role: 'pic',
      district_id: district2.id,
    },
  })

  await prisma.user_profiles.upsert({
    where: { user_id: picDistrict2.id },
    update: {
      full_name: 'PIC District 2',
      position: 'PIC District',
      nip: '3333333333',
      phone_number: '083333333333',
      nik_ktp: '3333333333333333',
      ktp_scan_path: 'placeholder/ktp_pic_district2.pdf',
    },
    create: {
      user_id: picDistrict2.id,
      full_name: 'PIC District 2',
      position: 'PIC District',
      nip: '3333333333',
      phone_number: '083333333333',
      nik_ktp: '3333333333333333',
      ktp_scan_path: 'placeholder/ktp_pic_district2.pdf',
    },
  })

  console.log('Seed PIC accounts berhasil')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
