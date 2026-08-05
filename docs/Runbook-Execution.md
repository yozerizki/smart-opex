# SmartOPEX End-to-End Runbook (Deployment + Migration + LDAP)

Runbook ini untuk tim IT Pertamina di Windows Server 2022.

Jawaban singkat:
1. Tim IT tidak perlu melakukan pengkodean apapun
2. Tim IT hanya perlu mengisi konfigurasi environment dan menjalankan command sesuai urutan.
3. Konfigurasi IIS/HTTPS dan Windows Service tetap dikerjakan manual sebagai pekerjaan infra.

## 0. Scope Runbook

Dokumen ini mencakup langkah keseluruhan:
1. Deployment backend dan frontend.
2. Migrasi data PostgreSQL ke SQL Server dengan dua opsi.
3. Integrasi LDAP/LDAPS untuk login production.

Pilihan metode migrasi data existing:
1. Opsi 1 (utama): backup/download/upload/restore lewat UI browser.
2. Opsi 2 (alternatif): script migrasi PG ke MSSQL (CLI).

## 1. Prasyarat Infrastruktur

Pastikan ini sudah siap:
1. Windows Server 2022.
2. Node.js 20.x dan npm 10+.
3. SQL Server 2022 target.
4. PostgreSQL source (untuk fase migrasi).
5. Redis server.
6. IIS + URL Rewrite + ARR.
7. Sertifikat HTTPS untuk domain produksi.
8. Utility `tar` tersedia di server dan dapat dipanggil dari PATH (wajib untuk backup/restore via browser).
9. Python untuk engine OCR tersedia di server target (disarankan Python 3.10/3.11).
10. Karena OCR akan memproses PDF, install Poppler dan pastikan binary Poppler tersedia di PATH.

Catatan OCR:
1. Provider OCR default project ini adalah PaddleOCR (lokal), bukan external service.
2. Jadi deployment Windows tetap bisa memakai OCR bawaan project, asalkan dependency Python siap.
3. requirements untuk OCR
    * paddleocr==2.7.3
    * paddlepaddle==2.6.2
    * pdf2image==1.17.0
    * pillow==10.4.0
    * numpy==1.26.4 

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

Tambahan env jika memakai Opsi 2 (script CLI):
1. PG_SOURCE_URL=<postgres-source-url>
2. MSSQL_TARGET_URL=<sqlserver-target-url>
3. MIGRATION_REPORT_PATH=backend/reports/migration-report.json
4. MIGRATION_VALIDATION_REPORT_PATH=backend/reports/migration-validation-report.json

Tambahan env OCR (sangat critical untuk Windows):
1. `OCR_PYTHON=python` atau path absolut python.exe yang valid di server.
2. Contoh Linux: `OCR_PYTHON=/opt/venv/bin/python`
3. Contoh Windows: `OCR_PYTHON=C:/Python39/python.exe`
4. Contoh Windows (venv): `OCR_PYTHON=C:/path/to/venv/Scripts/python.exe`
5. Jika memakai OCR provider external, variabel `OCR_PYTHON` tidak dipakai.

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

## 6. Migrasi Data Existing (Pilih Salah Satu Opsi)

### 6.1 Opsi 1 (Utama) - Migrasi Data via Browser

#### 6.1.1 Server Lama (VPS PostgreSQL)

1. Login sebagai akun pusat.
2. Buka menu backup/restore.
3. Tekan tombol backup untuk membuat backup terbaru.
4. Tekan tombol download backup untuk mengunduh file .tar.gz.
5. Simpan file .tar.gz sebagai artefak migrasi.

#### 6.1.2 Server Baru (Windows + SQL Server)

1. Pastikan deployment, build, dan prepare:prod:sqlserver sudah sukses.
2. Login sebagai akun pusat pada aplikasi di server baru.
3. Buka menu backup/restore.
4. Pilih file backup .tar.gz dari perangkat lokal.
5. Tekan tombol restore dari upload, lalu konfirmasi.
6. Tunggu notifikasi restore berhasil.

#### 6.1.3 Validasi Opsi 1

1. Login LDAP berhasil.
2. Akun local bypass pusat@smartopex.local tetap bisa login lokal.
3. Data dashboard dan data kegiatan tampil sesuai ekspektasi.
4. Sampel dokumen/upload lama dapat diakses.

### 6.2 Opsi 2 (Alternatif) - Migrasi Data via Script CLI

Gunakan opsi ini jika tim membutuhkan alur parity report berbasis script.

#### 6.2.1 Rehearsal Migrasi - Dry Run

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

#### 6.2.2 Eksekusi Migrasi - Apply

```powershell
cd C:\path\to\smart-opex\backend
$env:MIGRATION_DRY_RUN = "false"
$env:MIGRATION_TRUNCATE_BEFORE_LOAD = "true"
$env:MIGRATION_ALLOW_DESTRUCTIVE = "true"
npm run migrate:pg-to-mssql
```

#### 6.2.3 Validasi Parity Data

```powershell
cd C:\path\to\smart-opex\backend
npm run migrate:validate-parity
Get-Content .\reports\migration-validation-report.json -TotalCount 120
```

Syarat lulus:
1. Output menampilkan Validation passed.
2. Tidak ada baris MISMATCH.

## 7. Publish Frontend ke IIS

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

## 8. Konfigurasi Reverse Proxy IIS ke Backend

Konfigurasi manual di IIS URL Rewrite + ARR:
1. Route endpoint API ke http://localhost:3000.
2. Header Authorization harus diteruskan.
3. Pastikan CORS origin sesuai FRONTEND_ORIGINS.

## 9. Start Backend dan OCR Worker

Untuk uji awal, jalankan ini di 1 terminal:

```powershell
cd C:\path\to\smart-opex\backend
npm run start:prod:stack
```

Untuk operasi permanen, daftarkan sebagai Windows Service (manual infra).

## 10. Uji LDAP dan Smoke Test

Wajib lulus:
1. Login user LDAP valid berhasil.
2. User existing di SmartOPEX tidak berubah role/area/permission setelah login LDAP.
3. Akun local bypass pusat@smartopex.local tetap bisa login lokal.
4. Dashboard, upload dokumen, dan OCR queue berjalan.

## 11. Go-Live Checklist

Sistem dinyatakan siap jika:
1. Build backend dan frontend sukses.
2. prepare:prod:sqlserver sukses.
3. Jika memakai Opsi 1: backup-download-restore upload via UI sukses.
4. Jika memakai Opsi 2: dry-run, apply, dan parity validation sukses.
5. Login LDAP dan local bypass lulus.
6. Frontend HTTPS dan reverse proxy IIS berjalan.

## 12. Rollback Jika Gagal

1. Stop backend dan OCR worker.
2. Kembalikan koneksi runtime ke database lama.
3. Simpan log dan bukti error.
4. Jika gagal pada Opsi 1, ulangi restore upload dengan file backup tervalidasi.
5. Jika gagal pada Opsi 2, perbaiki konfigurasi lalu ulangi dari dry-run.

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
