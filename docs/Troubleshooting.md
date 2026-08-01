# Troubleshooting - SmartOPEX Migration

Dokumen ini merangkum error umum beserta penyebab, investigasi, dan solusi.

## 1. LDAP

### Error
Login LDAP gagal (Unauthorized).

### Kemungkinan Penyebab
- LDAP_URL/LDAP_BASE_DN/LDAP_BIND_DN/LDAP_BIND_PASSWORD salah.
- User tidak ditemukan dengan filter userPrincipalName.
- Password AD salah.
- Sertifikat LDAPS bermasalah.

### Investigasi
- Cek ENV runtime.
- Cek log aplikasi pada alur bind/search/bind-user.
- Uji koneksi ke host LDAP dari server aplikasi.

### Solusi
- Perbaiki ENV LDAP.
- Pastikan email login memakai UPN valid.
- Gunakan LDAPS yang benar dan trust chain sertifikat valid.

## 2. SQL Server

### Error
Aplikasi gagal konek database.

### Kemungkinan Penyebab
- Format DATABASE_URL salah.
- SQL login/password salah.
- Firewall/port 1433 tertutup.

### Investigasi
- Cek connection string di ENV.
- Uji koneksi dari host app ke SQL Server.
- Cek SQL Server login audit.

### Solusi
- Gunakan SQL Server Authentication yang valid.
- Perbaiki network/firewall rule.
- Verifikasi permission user DB.

## 3. Prisma

### Error
`prisma migrate deploy` gagal.

### Kemungkinan Penyebab
- Migration SQL masih PostgreSQL-specific.
- Schema drift antara target DB dan migration history.

### Investigasi
- Baca error detail migration.
- Bandingkan schema target dengan migration files.

### Solusi
- Gunakan migration SQL Server-native.
- Lakukan rehearsal migration sebelum production.

## 4. Redis

### Error
OCR worker tidak memproses queue.

### Kemungkinan Penyebab
- REDIS_URL salah.
- Redis tidak berjalan.
- Koneksi diblokir firewall.

### Investigasi
- Cek log worker saat startup.
- Uji koneksi Redis dari host aplikasi.

### Solusi
- Perbaiki REDIS_URL.
- Pastikan service Redis aktif dan reachable.

## 5. NestJS Backend

### Error
Aplikasi gagal start di AUTH_MODE=ldap.

### Kemungkinan Penyebab
- ENV wajib LDAP tidak lengkap.

### Investigasi
- Cek error startup validation.

### Solusi
- Lengkapi LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD, JWT_SECRET, dan LOCAL_AUTH_EMAILS.

## 6. Windows Service

### Error
Service backend/worker berhenti sendiri.

### Kemungkinan Penyebab
- Env file tidak ter-load oleh service manager.
- Working directory service salah.

### Investigasi
- Cek konfigurasi service (command, cwd, env).
- Cek event log / output log service.

### Solusi
- Set cwd benar (folder backend).
- Inject env vars pada service configuration.
- Aktifkan auto-restart policy.

## 7. IIS

### Error
Frontend terbuka, tapi API selalu 502/404.

### Kemungkinan Penyebab
- Rule reverse proxy salah.
- ARR belum aktif.
- Backend tidak running di port target.

### Investigasi
- Cek IIS rewrite rules.
- Cek backend health dari localhost server.

### Solusi
- Perbaiki route ke backend (mis. localhost:3000).
- Aktifkan ARR proxy.
- Pastikan backend hidup sebelum publish frontend.

## 8. Reverse Proxy / HTTPS

### Error
CORS atau auth header tidak terbaca.

### Kemungkinan Penyebab
- FRONTEND_ORIGINS tidak sesuai domain final.
- Header Authorization tidak diteruskan proxy.

### Investigasi
- Cek response header di browser devtools.
- Cek config CORS backend dan IIS rule.

### Solusi
- Set FRONTEND_ORIGINS ke domain HTTPS final.
- Pastikan reverse proxy pass-through header auth.

## 9. Data Backup/Restore

### Error
Restore gagal atau data user tidak sesuai.

### Kemungkinan Penyebab
- File backup tidak lengkap/invalid.
- Relasi data tidak konsisten.

### Investigasi
- Cek status backup file.
- Cek log restore transaction.

### Solusi
- Gunakan backup valid terbaru.
- Ulang restore di environment staging untuk validasi.
- Pastikan backup mencakup users dan user_profiles.
