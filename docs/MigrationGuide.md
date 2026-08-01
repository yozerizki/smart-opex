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

## 3.5 Rehearsal dan Sign-off

1. Lakukan rehearsal minimal 1 kali penuh di environment staging yang meniru produksi.
2. Simpan output log migrasi dan report parity sebagai bukti.
3. Dokumentasikan durasi aktual per langkah.
4. Catat gap performa atau mismatch data dan lakukan perbaikan sebelum hari cutover.
5. Sign-off hanya jika semua checklist lulus.

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
5. Pastikan tidak ada data parsial yang dipakai user di target saat rollback dilakukan.

## 7. Deliverables Minimal

- Log migrasi per tabel.
- Report verifikasi parity.
- Catatan error dan perbaikannya.
- Checklist sign-off go-live.

## 8. Checklist Rehearsal Cutover (Windows Server 2022, Non-Docker)

Checklist ini dipakai untuk tahap terakhir sebelum go-live.

## 8.1 Pre-Cutover Checklist

1. Pastikan host migrasi memiliki akses ke PostgreSQL source dan SQL Server target.
2. Verifikasi environment variable backend sudah lengkap:
  - DATABASE_URL (format Prisma sqlserver untuk runtime produksi)
  - PG_SOURCE_URL
  - MSSQL_TARGET_URL
  - MIGRATION_DRY_RUN
  - MIGRATION_TRUNCATE_BEFORE_LOAD
  - MIGRATION_ALLOW_DESTRUCTIVE
  - MIGRATION_REPORT_PATH
  - MIGRATION_VALIDATION_REPORT_PATH
3. Verifikasi auth mode produksi sesuai keputusan final:
  - AUTH_MODE=ldap
  - LOCAL_AUTH_EMAILS berisi akun lokal yang harus bypass LDAP (termasuk seed pusat)
4. Pastikan build backend sukses:
  - npm run build
5. Pastikan schema SQL Server siap:
  - npm run prepare:prod:sqlserver

## 8.2 Rehearsal Execution Flow

1. Jalankan dry-run migrasi terlebih dahulu:
  - MIGRATION_DRY_RUN=true
  - MIGRATION_TRUNCATE_BEFORE_LOAD=true
  - MIGRATION_ALLOW_DESTRUCTIVE=false
  - npm run migrate:pg-to-mssql
2. Simpan report dry-run dari MIGRATION_REPORT_PATH.
3. Jika dry-run lulus, jalankan apply migration:
  - MIGRATION_DRY_RUN=false
  - MIGRATION_TRUNCATE_BEFORE_LOAD=true
  - MIGRATION_ALLOW_DESTRUCTIVE=true
  - npm run migrate:pg-to-mssql
4. Simpan report apply migration dari MIGRATION_REPORT_PATH.
5. Jalankan parity validation:
  - npm run migrate:validate-parity
6. Simpan report validasi dari MIGRATION_VALIDATION_REPORT_PATH.

## 8.3 Acceptance Criteria Rehearsal

1. Tidak ada error runtime pada migrasi.
2. Semua tabel pada report parity status match.
3. Tidak ada blokir login pada akun LDAP.
4. Akun existing yang sudah ada di SmartOPEX tidak berubah role/area/permission.
5. Akun lokal seed pusat tetap dapat login melalui local auth bypass.
6. Durasi migrasi masih dalam maintenance window yang disetujui.

## 8.4 Bukti yang Wajib Disimpan

1. File report dry-run.
2. File report apply migration.
3. File report parity validation.
4. Ringkasan hasil smoke test API dan login.
5. Catatan waktu mulai-selesai tiap langkah rehearsal.

## 8.5 Go/No-Go Decision

Status Go jika seluruh syarat berikut terpenuhi:
1. Parity validation lulus.
2. Tidak ada error kritis pada log.
3. Smoke test endpoint utama lulus.
4. LDAP login dan local bypass account lulus.
5. Tim aplikasi dan tim infra menandatangani checklist sign-off.

Status No-Go jika salah satu syarat di atas gagal.
