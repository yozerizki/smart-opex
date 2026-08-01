# SmartOPEX End-to-End Runbook (Deployment + Migration + LDAP)

Runbook ini untuk tim IT Pertamina di Windows Server 2022.

Jawaban singkat:
1. Tim IT tidak perlu ngoding aplikasi.
2. Tim IT perlu mengisi konfigurasi environment dan menjalankan command sesuai urutan.
3. Konfigurasi IIS/HTTPS dan Windows Service tetap dikerjakan manual sebagai pekerjaan infra.

## 0. Scope Runbook

Dokumen ini mencakup langkah keseluruhan:
1. Deployment backend dan frontend.
2. Migrasi data PostgreSQL ke SQL Server.
3. Integrasi LDAP/LDAPS untuk login production.

## 1. Prasyarat Infrastruktur

Pastikan ini sudah siap:
1. Windows Server 2022.
2. Node.js 20.x dan npm 10+.
3. SQL Server 2022 target.
4. PostgreSQL source (untuk fase migrasi).
5. Redis server.
6. IIS + URL Rewrite + ARR.
7. Sertifikat HTTPS untuk domain produksi.

## 2. Persiapan Folder dan Dependency

Buka PowerShell sebagai Administrator, lalu jalankan:

```powershell
cd C:\path\to\smart-opex\backend
npm ci

cd ..\frontend
npm ci
```

## 3. Konfigurasi Environment (Wajib)

Jalankan:

```powershell
cd C:\path\to\smart-opex
Copy-Item .env.example .env -Force
notepad .env
```

Isi minimal nilai berikut:
1. PORT=3000
2. JWT_SECRET=<strong-secret>
3. AUTH_MODE=ldap
4. LOCAL_AUTH_EMAILS=pusat@smartopex.local
5. DATABASE_URL=<sqlserver-prisma-runtime-url>
6. REDIS_URL=<redis-url>
7. FRONTEND_ORIGINS=https://<domain-frontend-produksi>
8. LDAP_URL=ldaps://<ad-host>:636
9. LDAP_BASE_DN=<base-dn>
10. LDAP_BIND_DN=<service-account-dn>
11. LDAP_BIND_PASSWORD=<service-account-password>
12. PG_SOURCE_URL=<postgres-source-url>
13. MSSQL_TARGET_URL=<sqlserver-target-url>
14. MIGRATION_REPORT_PATH=backend/reports/migration-report.json
15. MIGRATION_VALIDATION_REPORT_PATH=backend/reports/migration-validation-report.json

## 4. Build Aplikasi

```powershell
cd C:\path\to\smart-opex\backend
npm run build

cd ..\frontend
npm run build
```

## 5. Siapkan Schema SQL Server

```powershell
cd C:\path\to\smart-opex\backend
npm run prepare:prod:sqlserver
```

## 6. Rehearsal Migrasi - Dry Run

```powershell
cd C:\path\to\smart-opex\backend
$env:MIGRATION_DRY_RUN = "true"
$env:MIGRATION_TRUNCATE_BEFORE_LOAD = "true"
$env:MIGRATION_ALLOW_DESTRUCTIVE = "false"
npm run migrate:pg-to-mssql
Get-Content .\reports\migration-report.json -TotalCount 80
```

Syarat lulus:
1. Command selesai tanpa error.
2. Report dry-run terbentuk.

## 7. Eksekusi Migrasi - Apply

```powershell
cd C:\path\to\smart-opex\backend
$env:MIGRATION_DRY_RUN = "false"
$env:MIGRATION_TRUNCATE_BEFORE_LOAD = "true"
$env:MIGRATION_ALLOW_DESTRUCTIVE = "true"
npm run migrate:pg-to-mssql
```

## 8. Validasi Parity Data

```powershell
cd C:\path\to\smart-opex\backend
npm run migrate:validate-parity
Get-Content .\reports\migration-validation-report.json -TotalCount 120
```

Syarat lulus:
1. Output menampilkan Validation passed.
2. Tidak ada baris MISMATCH.

## 9. Publish Frontend ke IIS

Copy hasil build frontend ke folder web IIS.

Contoh:

```powershell
New-Item -ItemType Directory -Path C:\inetpub\smartopex -Force | Out-Null
Copy-Item C:\path\to\smart-opex\frontend\dist\* C:\inetpub\smartopex -Recurse -Force
```

Lalu konfigurasi manual di IIS:
1. Buat site dengan binding HTTPS.
2. Pasang sertifikat TLS produksi.
3. Aktifkan SPA fallback ke index.html.

## 10. Konfigurasi Reverse Proxy IIS ke Backend

Konfigurasi manual di IIS URL Rewrite + ARR:
1. Route endpoint API ke http://localhost:3000.
2. Header Authorization harus diteruskan.
3. Pastikan CORS origin sesuai FRONTEND_ORIGINS.

## 11. Start Backend dan OCR Worker

Untuk uji awal, jalankan ini di 1 terminal:

```powershell
cd C:\path\to\smart-opex\backend
npm run start:prod:stack
```

Untuk operasi permanen, daftarkan sebagai Windows Service (manual infra).

## 12. Uji LDAP dan Smoke Test

Wajib lulus:
1. Login user LDAP valid berhasil.
2. User existing di SmartOPEX tidak berubah role/area/permission setelah login LDAP.
3. Akun local bypass pusat@smartopex.local tetap bisa login lokal.
4. Dashboard, upload dokumen, dan OCR queue berjalan.

## 13. Go-Live Checklist

Sistem dinyatakan siap jika:
1. Build backend dan frontend sukses.
2. prepare:prod:sqlserver sukses.
3. Dry-run migrasi sukses.
4. Apply migrasi sukses.
5. Validation parity sukses tanpa mismatch.
6. Login LDAP dan local bypass lulus.
7. Frontend HTTPS dan reverse proxy IIS berjalan.

## 14. Rollback Jika Gagal

1. Stop backend dan OCR worker.
2. Kembalikan koneksi runtime ke database lama.
3. Simpan log dan report migrasi/validasi.
4. Perbaiki konfigurasi, ulangi dari langkah dry-run.

## Appendix A - Contoh URL

PG_SOURCE_URL:

```text
postgresql://user:password@source-host:5432/smartopex
```

MSSQL_TARGET_URL:

```text
sqlserver://target-host:1433;database=smartopex;user=sa;password=StrongPass123!;encrypt=true;trustServerCertificate=true
```

DATABASE_URL:

```text
sqlserver://app-db-host:1433;database=smartopex;user=app_user;password=StrongPass123!;encrypt=true;trustServerCertificate=true
```
