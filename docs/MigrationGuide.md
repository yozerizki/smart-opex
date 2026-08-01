# Migration Guide - PostgreSQL ke SQL Server

Panduan migrasi database SmartOPEX dari PostgreSQL ke Microsoft SQL Server 2022.

## 1. Objective

- Memindahkan schema dan data tanpa kehilangan data.
- Menjaga kompatibilitas business flow.
- Menjaga auditability proses migrasi.

## 2. Scope dan Asumsi

- Target DB: SQL Server 2022.
- Mode auth database: SQL Server Authentication.
- Cutover: one-time full migration saat go-live.
- Docker production tidak digunakan.

## 3. Tahapan Migrasi

## 3.1 Persiapan

1. Backup penuh PostgreSQL source.
2. Freeze write window saat cutover.
3. Siapkan SQL Server target kosong.
4. Pastikan konektivitas dari host migrasi ke dua database.

## 3.2 Schema Migration

1. Ubah provider Prisma ke sqlserver.
2. Regenerasi/migrasi schema SQL Server native.
3. Audit bagian PostgreSQL-specific:
   - ON CONFLICT
   - sequence reset (setval/pg_get_serial_sequence)

## 3.3 Data Migration

Rekomendasi utama:
- Gunakan script migrasi terkontrol (Node.js) untuk:
  - extract dari PostgreSQL
  - transform type
  - load ke SQL Server

Urutan tabel mengikuti dependency FK:
- master tables dulu (group_views, regions, areas, districts)
- users dan profiles
- transaksi opex dan dokumen
- audit logs

## 3.4 Verifikasi

Wajib setelah load:
- row count parity per tabel
- nullability check
- orphan foreign key check
- sampling numeric precision (Decimal)
- sampling tanggal/waktu

## 4. Mapping Tipe Data

- Int autoincrement -> INT IDENTITY
- Decimal(15,2) -> DECIMAL(15,2)
- DateTime timestamp -> DATETIME2
- Date -> DATE
- String -> NVARCHAR/VARCHAR sesuai schema

## 5. Risiko dan Mitigasi

- Risiko syntax SQL PostgreSQL tidak kompatibel:
  - mitigasi: gunakan migration SQL Server native.
- Risiko sequence/identity mismatch setelah restore:
  - mitigasi: reseed identity di SQL Server.
- Risiko data mismatch:
  - mitigasi: verifikasi parity + sign-off checklist.

## 6. Rollback Plan

Jika verifikasi gagal:
1. Stop aplikasi ke target SQL Server.
2. Kembalikan koneksi aplikasi ke database source lama.
3. Investigasi hasil report migrasi.
4. Ulang migrasi di rehearsal sebelum jadwal ulang cutover.

## 7. Deliverables Minimal

- Log migrasi per tabel.
- Report verifikasi parity.
- Catatan error dan perbaikannya.
- Checklist sign-off go-live.
