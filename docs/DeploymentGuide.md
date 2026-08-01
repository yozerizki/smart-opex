# Deployment Guide - Windows Server 2022 (No Docker)

Panduan menjalankan SmartOPEX production secara native pada Windows Server 2022.

## 1. Prasyarat

- Windows Server 2022
- Node.js 20+
- npm 10+
- Python 3.x (untuk OCR provider lokal)
- Redis server
- Microsoft SQL Server 2022
- IIS + URL Rewrite + ARR

## 2. Struktur Proses Runtime

- Backend API (NestJS)
- OCR Worker (Node process terpisah)
- Frontend static build (Vite dist) disajikan via IIS
- Redis untuk queue OCR
- SQL Server untuk database aplikasi

## 3. Install Dependency

```bash
cd backend
npm ci

cd ../frontend
npm ci
```

## 4. Konfigurasi Environment

Gunakan .env production untuk backend.

Contoh minimum:

```env
PORT=3000
JWT_SECRET=replace-with-strong-secret
AUTH_MODE=ldap
LOCAL_AUTH_EMAILS=pusat@smartopex.local

DATABASE_URL=sqlserver://user:password@dbhost:1433;database=smartopex;encrypt=true;trustServerCertificate=true
REDIS_URL=redis://redis-host:6379
FRONTEND_ORIGINS=https://smartopex.pertamina.com

LDAP_URL=ldaps://ad.pertamina.com:636
LDAP_BASE_DN=DC=pertamina,DC=com
LDAP_BIND_DN=CN=svc-smartopex,OU=Service Accounts,DC=pertamina,DC=com
LDAP_BIND_PASSWORD=replace-with-secure-value
```

## 5. Build

```bash
cd backend
npm run build

cd ../frontend
npm run build
```

## 6. Database Migration

```bash
cd backend
npx prisma migrate deploy
```

Catatan:
- Jalankan backup database sebelum migration.
- Seed dijalankan sesuai kebutuhan operasional.

## 7. Menjalankan Backend dan OCR Worker

Backend API:

```bash
cd backend
npm run start:prod
```

OCR Worker:

```bash
cd backend
npm run start:ocr-worker
```

Disarankan jalankan keduanya sebagai Windows Service (misalnya NSSM/PM2).

## 8. Menjalankan Frontend di IIS

1. Build frontend (`frontend/dist`).
2. Deploy isi dist ke folder web IIS.
3. Konfigurasi site binding HTTPS.
4. Aktifkan SPA fallback ke index.html.

## 9. IIS Reverse Proxy ke Backend

Gunakan URL Rewrite + ARR:
- route `/api/*` atau seluruh request API ke `http://localhost:3000`.
- pastikan header `Authorization` diteruskan.
- aktifkan HTTPS termination di IIS.

## 10. Checklist Smoke Test

- Login LDAP berhasil.
- Seed account pusat local login tetap berhasil.
- Upload dokumen dan OCR queue berjalan.
- Dashboard load normal.
- Export Excel berjalan.
- Backup/restore endpoint dapat diakses sesuai role.

## 11. Docker Dev Tetap Dipertahankan

Panduan ini hanya untuk production non-Docker.
Docker Compose untuk development tidak dihapus dan tetap menjadi jalur dev utama.
