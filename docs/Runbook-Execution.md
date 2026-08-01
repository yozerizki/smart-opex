# SmartOPEX Migration Runbook (Copy Paste)

Runbook ini ditujukan untuk tim IT klien di Windows Server 2022.

Target: migrasi PostgreSQL ke SQL Server selesai tanpa ngoding aplikasi.

## 0. Prasyarat

Pastikan ini sudah ada sebelum mulai:

1. Node.js 20.x terpasang.
2. Akses ke PostgreSQL source.
3. Akses ke SQL Server 2022 target.
4. Redis sudah tersedia untuk runtime aplikasi.
5. Repo SmartOPEX sudah di-clone ke server.

## 1. Buka PowerShell dan masuk ke folder backend

```powershell
cd C:\path\to\smart-opex\backend
```

## 2. Install dependency

```powershell
npm ci
```

Sukses jika tidak ada error dan proses selesai.

## 3. Buat file .env dari template

```powershell
Copy-Item ..\.env.example ..\.env -Force
notepad ..\.env
```

Isi minimal nilai ini di file .env:

1. DATABASE_URL (format Prisma sqlserver, untuk runtime aplikasi)
2. PG_SOURCE_URL (PostgreSQL sumber data)
3. MSSQL_TARGET_URL (SQL Server target data migrasi)
4. JWT_SECRET
5. AUTH_MODE=ldap
6. LOCAL_AUTH_EMAILS=pusat@smartopex.local
7. LDAP_URL
8. LDAP_BASE_DN
9. LDAP_BIND_DN
10. LDAP_BIND_PASSWORD
11. MIGRATION_REPORT_PATH=backend/reports/migration-report.json
12. MIGRATION_VALIDATION_REPORT_PATH=backend/reports/migration-validation-report.json

Simpan file, lalu tutup Notepad.

## 4. Build dan siapkan schema SQL Server

```powershell
npm run prepare:prod:sqlserver
```

Sukses jika command selesai tanpa error.

## 5. Jalankan dry-run migrasi (tanpa ubah data target)

```powershell
$env:MIGRATION_DRY_RUN = "true"
$env:MIGRATION_TRUNCATE_BEFORE_LOAD = "true"
$env:MIGRATION_ALLOW_DESTRUCTIVE = "false"
npm run migrate:pg-to-mssql
```

Sukses jika muncul log selesai dan file report dry-run terbentuk.

Cek report:

```powershell
Get-Content .\reports\migration-report.json -TotalCount 60
```

## 6. Jalankan apply migrasi (menulis data ke SQL Server)

```powershell
$env:MIGRATION_DRY_RUN = "false"
$env:MIGRATION_TRUNCATE_BEFORE_LOAD = "true"
$env:MIGRATION_ALLOW_DESTRUCTIVE = "true"
npm run migrate:pg-to-mssql
```

Sukses jika muncul log migration completed successfully.

## 7. Jalankan validasi parity jumlah data

```powershell
npm run migrate:validate-parity
```

Sukses jika muncul Validation passed dan tidak ada MISMATCH.

Cek report validasi:

```powershell
Get-Content .\reports\migration-validation-report.json -TotalCount 80
```

## 8. Start service aplikasi (API + OCR worker)

```powershell
npm run start:prod:stack
```

Biarkan proses tetap berjalan.

## 9. Smoke test setelah start

Lakukan pengecekan berikut:

1. Login user LDAP berhasil.
2. Akun local bypass (pusat@smartopex.local) tetap bisa login lokal.
3. Endpoint API utama bisa diakses.

## 10. Kriteria selesai migrasi

Migrasi dianggap selesai jika semua ini benar:

1. prepare:prod:sqlserver sukses.
2. dry-run sukses.
3. apply migrasi sukses.
4. validate parity sukses tanpa mismatch.
5. login LDAP dan local bypass sukses.

## 11. Jika gagal

Lakukan rollback operasional:

1. Stop proses aplikasi.
2. Kembalikan koneksi runtime ke database lama.
3. Simpan log error dan report untuk analisis.
4. Perbaiki parameter/env, lalu ulangi dari langkah dry-run.

## Appendix A - Contoh format connection string

Contoh PG_SOURCE_URL:

```text
postgresql://user:password@source-host:5432/smartopex
```

Contoh MSSQL_TARGET_URL format Prisma:

```text
sqlserver://target-host:1433;database=smartopex;user=sa;password=StrongPass123!;encrypt=true;trustServerCertificate=true
```

Contoh DATABASE_URL format Prisma:

```text
sqlserver://app-db-host:1433;database=smartopex;user=app_user;password=StrongPass123!;encrypt=true;trustServerCertificate=true
```
