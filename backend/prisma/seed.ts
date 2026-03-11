import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // cleanup dependent rows so hierarchy and master refs can be reset safely
  await prisma.$transaction(async (tx) => {
    await tx.ocr_results.deleteMany({})
    await tx.documents.deleteMany({})
    await tx.opex_receipts.deleteMany({})
    await tx.opex_items.deleteMany({})
    await tx.audit_logs.deleteMany({})

    await tx.users.updateMany({
      data: {
        district_id: null,
        area_id: null,
      },
    })

    await tx.districts.deleteMany({})
    await tx.areas.deleteMany({})
    await tx.regions.deleteMany({})
    await tx.group_views.deleteMany({})
  })

  const groupViews = [
    'Meal, Drink & Snack',
    'Non Core Activity (BAPOR, Komunitas, Etc)',
    'ATK, Copy & Jilid dokument, dan Pengiriman Dokumen',
    'Utilities',
    'Retribusi (Sampah, Kebersihan, dsb)',
    'Pemeliharaan Aset Perusahaan (Damkar, dll) yang dilakukan perorangan',
    'Dokumen PO',
    'Rincian Excel',
    'Honorarium',
    'Internet, TV Kabel, fasilitasi multimedia lainnya - IT Operation',
    'Biaya Pajak (diluar PPN, PPh, PDRI, PBBKB), Retribusi, Perpanjangan Surat Perijinan',
    'Relationship internal/external (karangan bunga dukacita, ucapan selamat)',
    'Event Keagamaan',
    'Land Acquisition - explorasi & produksi',
    'Agency Cost - Marine',
    'Konpensasi aktivitasi eksplorasi/eksploitasi - EP',
    'Honorarium - PCU',
    'Penyelesaian perkara hukum (legal dispute) - Fungsi Legal',
    'Training (inhouse/external) - PCU',
    'Apresiasi Untuk UTD Pekerja - HR',
    'Biaya Transportasi',
    'Biaya operasional tenaga kerja penunjang fungsi (OS, Internship, Calon Pekerja)',
    'Extraodinary Expense (Bencana Alam, Lakalantas, dll) dan Emergency',
    'Biaya Sertifikasi Profesi',
    'Gethering/Outbond/Values Day',
    'Event Sosial',
    'Rakor/Konsinyering',
    'Event Tournament/Kompetisi',
    'Pemindahan RIG PDSI',
    'Pembelian Souvenir Apresiasi Pekerja',
    'Program Fit to Work',
    'Claim dinas pekerja yang sudah makan',
    'Biaya keamanan & koordinasi',
    'PNBP Penerimaan Negara (Non Kepelabuhan)',
    'Tenaga Ahli Direct Hire, Biaya dinas konsultan',
    'Paket data WFH (Pekerja, JDP dan TKJP) - Selama masa Pandemi',
    'Kegiatan Research & Development',
    'Lisensi / Hak Paten untuk Perorangan maupun lembaga',
    'Dokumen PR',
    'Surat PJS / SP3S',
  ]

  await prisma.group_views.createMany({
    data: groupViews.map((name) => ({ name })),
    skipDuplicates: true,
  })

  const regionWest = await prisma.regions.create({
    data: { name: 'Operation West Regional' },
  })

  const regionEast = await prisma.regions.create({
    data: { name: 'Operation East Regional' },
  })

  await prisma.areas.createMany({
    data: [
      { region_id: regionWest.id, name: 'Operation North Sumatra Area' },
      { region_id: regionWest.id, name: 'Operation Central Sumatra Area' },
      { region_id: regionWest.id, name: 'Operation South Sumatra Area' },
      { region_id: regionWest.id, name: 'Operation Dumai Area' },
      { region_id: regionWest.id, name: 'Operation Rokan Area' },
      { region_id: regionWest.id, name: 'Operation West Java Area' },
      { region_id: regionEast.id, name: 'Operation East Java Area' },
      { region_id: regionEast.id, name: 'Operation Kalimantan Area' },
    ],
    skipDuplicates: true,
  })

  const passwordHash = await bcrypt.hash('password123', 10)
  const oeja = await prisma.areas.findFirst({ where: { name: 'Operation East Java Area' } })
  if (!oeja) {
    throw new Error('Operation East Java Area not found after seeding')
  }

  const verifikator = await prisma.users.upsert({
    where: { email: 'verifikator@smartopex.local' },
    update: {
      password_hash: passwordHash,
      role: 'verifikator',
      area_id: oeja.id,
      district_id: null,
    },
    create: {
      email: 'verifikator@smartopex.local',
      password_hash: passwordHash,
      role: 'verifikator',
      area_id: oeja.id,
      district_id: null,
    },
  })

  await prisma.users.upsert({
    where: { email: 'pusat@smartopex.local' },
    update: {
      password_hash: passwordHash,
      role: 'pusat',
      district_id: null,
      area_id: null,
    },
    create: {
      email: 'pusat@smartopex.local',
      password_hash: passwordHash,
      role: 'pusat',
      district_id: null,
      area_id: null,
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

  console.log('Seed master data (group view, region, area) berhasil')
  console.log('Seed user dasar (pusat, verifikator) berhasil')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
