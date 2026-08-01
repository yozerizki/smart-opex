# Architecture Changes - SmartOPEX Migration

Dokumen ini merangkum perubahan arsitektur dari mode awal (PostgreSQL + local auth) ke target enterprise Pertamina (SQL Server + LDAP) tanpa mengubah business flow.

## 1. Tujuan Perubahan

- Menjalankan aplikasi pada Windows Server 2022 tanpa Docker di production.
- Mengganti database dari PostgreSQL ke Microsoft SQL Server 2022.
- Menambahkan autentikasi Active Directory (LDAP/LDAPS) dengan JWT tetap dipakai oleh aplikasi.
- Menjaga authorization tetap berbasis role di database SmartOPEX.

## 2. Scope Teknis

- In scope:
  - Prisma provider berubah ke sqlserver.
  - Mekanisme migrasi data PostgreSQL -> SQL Server.
  - Mode autentikasi AUTH_MODE=local atau AUTH_MODE=ldap.
  - Startup validation untuk ENV kritikal.
  - Dokumentasi deployment native Windows + IIS reverse proxy.
- Out of scope (fase ini):
  - Windows Integrated Authentication untuk SQL Server.
  - Hybrid auth mode (ldap + fallback local untuk semua user).
  - Sinkronisasi role dari LDAP group.

## 3. Authentication Design (Final)

- AUTH_MODE=local:
  - Dipakai untuk development/testing.
  - Login menggunakan email + password lokal.
- AUTH_MODE=ldap:
  - Dipakai untuk production Pertamina.
  - Login menggunakan email Active Directory (UPN / userPrincipalName) + password AD.

Aturan penting:
- Seed account pusat dikecualikan dari LDAP authentication dan tetap local login.
- Jika email LDAP sudah ada di database SmartOPEX:
  - Jangan overwrite role, area assignment, atau permissions.
- Automatic provisioning hanya berjalan jika email belum ada di database.
- Default role untuk akun hasil provisioning LDAP: PIC.

## 4. Authorization Tetap di SmartOPEX

- LDAP hanya memverifikasi identitas user.
- Role pusat/verifikator/pic tetap sumber kebenarannya di database SmartOPEX.
- Guard dan aturan akses existing tetap dipertahankan.

## 5. Data Compatibility Principles

- Business logic tidak diubah.
- API contract tidak diubah kecuali kebutuhan internal infrastruktur.
- Development Docker tetap dipertahankan.
- Production native Windows wajib dikonfigurasi full via .env.

## 6. Operasional Cutover

- Cutover data: one-time full migration saat go-live window.
- Backup penuh sebelum migrasi.
- Verifikasi parity setelah migrasi (row count, sampling checksum, relasi FK).
- Rollback decision berdasarkan checklist verifikasi.

## 7. Dampak Operasional

- Tim IT dapat mengelola deployment tanpa akses developer ke server production.
- Perubahan role user tetap dilakukan dari SmartOPEX (Manage Users), bukan dari LDAP group.
- Aplikasi tetap mendukung skenario dev lama berbasis Docker.
