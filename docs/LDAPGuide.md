# LDAP Guide - SmartOPEX

Panduan implementasi autentikasi LDAP/LDAPS untuk SmartOPEX.

## 1. Prinsip Integrasi

- LDAP dipakai hanya untuk autentikasi identitas.
- JWT tetap token sesi aplikasi.
- Authorization tetap berbasis role di database SmartOPEX.
- Identifier login LDAP dikunci ke userPrincipalName (email UPN).

## 2. Mode Auth

- AUTH_MODE=local
  - Login lokal email + password.
  - Untuk development/testing.
- AUTH_MODE=ldap
  - Login via Active Directory (email UPN + password).
  - Untuk production.

Hybrid mode tidak dipakai.

## 3. Aturan User Existing dan Provisioning

- Jika email LDAP sudah ada di SmartOPEX:
  - Gunakan akun existing.
  - Jangan ubah role, area assignment, atau permissions.
- Jika email LDAP belum ada:
  - Buat user baru otomatis.
  - Role default: PIC.
- Seed account pusat:
  - Dikecualikan dari LDAP auth.
  - Tetap local login.

## 4. Environment Variables

Wajib saat AUTH_MODE=ldap:

- LDAP_URL
- LDAP_BASE_DN
- LDAP_BIND_DN
- LDAP_BIND_PASSWORD
- JWT_SECRET
- LOCAL_AUTH_EMAILS (untuk seed account yang tetap local)

Contoh:

```env
AUTH_MODE=ldap
JWT_SECRET=replace-with-strong-secret
LOCAL_AUTH_EMAILS=pusat@smartopex.local
LDAP_URL=ldaps://ad.pertamina.com:636
LDAP_BASE_DN=DC=pertamina,DC=com
LDAP_BIND_DN=CN=svc-smartopex,OU=Service Accounts,DC=pertamina,DC=com
LDAP_BIND_PASSWORD=replace-with-secure-value
```

## 5. Alur Login LDAP

1. User kirim email + password.
2. Sistem cek apakah email termasuk LOCAL_AUTH_EMAILS.
3. Jika bukan local-only account, sistem auth ke LDAP:
   - bind service account
   - search user dengan filter userPrincipalName=email
   - bind sebagai user untuk verifikasi password
4. Jika sukses, sistem cek user di database SmartOPEX:
   - ada: pakai data existing
   - tidak ada: provisioning user baru role PIC
5. Sistem menerbitkan JWT.

## 6. Startup Validation

Aplikasi gagal boot jika AUTH_MODE=ldap tetapi ENV penting tidak lengkap. Ini mencegah error terlambat saat login pertama.

## 7. Catatan Security

- Jangan hardcode credential LDAP di source code.
- Simpan semua secret di environment management milik tim IT.
- Gunakan LDAPS bila tersedia.
- Batasi hak service account LDAP ke read-only directory lookup.
