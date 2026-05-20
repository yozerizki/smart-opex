# Panduan Penggunaan SmartOPEX

Dokumen ini menjelaskan cara menggunakan sistem SmartOPEX berdasarkan tiga level akses:

1. **PIC District** — membuat dan mengelola kegiatan OPEX
2. **Verifikator Area** — memverifikasi kegiatan dan mengelola pengguna di area
3. **Pusat (Admin)** — akses penuh ke seluruh fitur sistem

---

## BAGIAN 1 — PANDUAN PIC DISTRICT

### 1.1 Login

1. Buka aplikasi SmartOPEX dari browser.
2. Masukkan **email** dan **kata sandi** akun PIC yang telah diberikan oleh Verifikator.
3. Tekan tombol **login**.
4. Jika berhasil, sistem akan otomatis membawa ke halaman **Dashboard**.

> Jika muncul pesan kesalahan, periksa kembali email dan kata sandi. Hubungi Verifikator jika lupa kata sandi.

---

### 1.2 Memahami Dashboard

Setelah login, halaman Dashboard menampilkan:

- **Ringkasan status kegiatan** di bagian atas:
  - Kotak biru **OK** — jumlah kegiatan yang sudah sesuai atau telah direview.
  - Kotak merah **PERLU REVIEW** — jumlah kegiatan yang membutuhkan perhatian.

- **Filter bulan** — secara default menampilkan bulan berjalan. Dapat diubah untuk melihat bulan lain.

- **Filter status** — untuk menyaring tampilan berdasarkan status (Semua / OK & Telah Direview / Perlu Review).

- **Tabel daftar kegiatan** — menampilkan kolom: Tanggal, Nama Kegiatan, Group View, Region, Area, Distrik, Nama Toko/Penerima, Total (PIC), Total (AI), Status, dan Aksi.

  - Baris berwarna **hijau** = status OK atau Telah Direview.
  - Baris berwarna **kuning** = status Perlu Review.
  - Kolom **Total (AI)** menampilkan hasil pembacaan AI (OCR). Jika masih dalam proses, akan muncul label "OCR pending".

- **Tombol Ekspor ke Excel** — mengunduh data kegiatan yang ditampilkan ke dalam format .xlsx.

---

### 1.3 Membuat Kegiatan Baru

1. Dari Dashboard, tekan tombol **Tambah Kegiatan** (warna hijau).
2. Isi formulir yang muncul:

   | Field | Keterangan |
   |---|---|
   | **Nama Kegiatan** | Deskripsi singkat kegiatan |
   | **Pengeluaran** | Nilai nominal dalam rupiah (angka saja, titik pemisah ribuan otomatis) |
   | **District** | Sudah terisi otomatis sesuai district akun PIC, tidak dapat diubah |
   | **Group View** | Pilih kategori pengeluaran dari daftar yang tersedia |
   | **Nama Toko / Penerima** | Nama toko atau pihak penerima pembayaran |
   | **Tanggal Transaksi** | Tanggal transaksi (tidak bisa diisi tanggal di masa depan) |

3. Unggah **File Nota** (wajib, minimal 1, maksimal 10 file):
   - Format: **PDF**
   - Satu file = satu invoice, satu halaman.
   - Gunakan slip pembayaran akhir yang sudah mencakup semua biaya.
   - Pastikan berkas utuh, jelas, tidak dirotasi.
   - Dokumen berupa tabel rekapitulasi juga dapat diterima.
   - Tekan **Tambah Nota** untuk menambah slot file berikutnya.

4. Unggah **Dokumentasi Kegiatan** (wajib, minimal 1):
   - Format: JPG, JPEG, PNG, atau PDF.
   - Foto atau dokumen bukti kegiatan berlangsung.
   - Tekan **Tambah File** untuk menambah file.

5. Unggah **Bukti / Dokumentasi Pendukung** (wajib, minimal 1):
   - Format: JPG, JPEG, PNG, atau PDF.
   - Dokumen pendukung tambahan (misalnya: undangan, surat tugas, screenshot transfer).
   - Tekan **Tambah File** untuk menambah file.

6. Tekan **Simpan** untuk menyimpan kegiatan.
7. Sistem akan langsung membawa ke halaman **Detail Kegiatan**. AI akan mulai membaca nota secara otomatis di latar belakang.

---

### 1.4 Melihat dan Mengedit Kegiatan

Dari Dashboard, tekan **Lihat** pada baris kegiatan yang ingin dilihat.

Halaman Detail menampilkan:

- Informasi lengkap kegiatan (nama, group view, district, tanggal, nama toko/penerima).
- **Panel Perbandingan** — membandingkan Total (PIC) dan Total (AI):
  - Panel berwarna **hijau** jika nilai keduanya sama (status = OK).
  - Panel berwarna **kuning** jika nilai berbeda (status = PERLU REVIEW).
- **Status kegiatan** saat ini.
- Daftar **File Nota** beserta hasil pembacaan AI per nota.
- Daftar **Dokumentasi Kegiatan** dan **Bukti Pendukung**.

**Untuk mengedit kegiatan:**

1. Tekan tombol **Edit** (muncul di halaman detail).
2. Field yang dapat diubah menjadi aktif (nama kegiatan, pengeluaran, group view, tanggal, nama toko/penerima).
3. Untuk **menambah nota baru**: tekan tombol **Tambah Nota** pada bagian File Nota.
4. Untuk **menghapus nota**: tekan tombol **Hapus** di samping file nota yang ingin dihapus.
5. Setelah selesai, tekan **Simpan** untuk menyimpan perubahan, atau **Batal** untuk membatalkan.

---

### 1.5 Menangani Status PERLU REVIEW

Status **PERLU REVIEW** muncul ketika nilai yang diinput PIC berbeda dengan hasil pembacaan AI.

Ada dua kemungkinan penanganan:

**A. Nilai PIC yang salah** — PIC salah input nominal:
1. Tekan tombol **Edit**.
2. Perbaiki nilai di field **Pengeluaran** sesuai nota yang sebenarnya.
3. Tekan **Simpan**. Jika nilai sudah sama dengan hasil AI, status akan berubah menjadi **OK** secara otomatis.

**B. Hasil AI yang salah** — AI salah membaca nota:
1. Buka setiap file nota dengan menekan tombol **Lihat Nota** dan periksa isinya satu per satu.
2. Setelah **semua nota sudah dibuka/dilihat**, akan muncul tombol **tandai 'telah direview'**.
3. Baca konfirmasi yang muncul, lalu tekan **OK**.
4. Status akan berubah menjadi **TELAH DIREVIEW**, artinya PIC menyatakan nilai inputannya yang benar.

> Jika sudah ditandai "Telah Direview" namun ingin dibatalkan, akan muncul tombol **kembalikan ke 'Perlu Review'** (hanya tersedia selama nilai PIC dan AI masih berbeda).

---

## BAGIAN 2 — PANDUAN VERIFIKATOR AREA

Verifikator memiliki semua kemampuan PIC, ditambah akses untuk mengelola pengguna dan melihat kegiatan seluruh PIC di area yang sama.

### 2.1 Perbedaan Tampilan Dashboard

Verifikator mendapatkan tambahan filter di Dashboard:

- **Filter Area** — secara default menampilkan area verifikator sendiri.
- **Filter District** — untuk menyaring berdasarkan district tertentu dalam area.

Verifikator dapat melihat semua kegiatan dari seluruh PIC yang berada di area yang sama.

---

### 2.2 Membuat Kegiatan (Atas Nama District Tertentu)

Saat Verifikator membuat kegiatan, field **District** dapat dipilih dari dropdown (tidak terkunci seperti PIC). Pilih district yang sesuai sebelum menyimpan.

---

### 2.3 Mengelola Pengguna (Manage Users)

Verifikator dapat mengakses menu **Manage Users** dari bilah navigasi.

**Menambah akun PIC baru:**

1. Klik **Manage Users** di menu atas.
2. Isi formulir di bagian **Tambah Pengguna**:
   - **Nama Lengkap** (wajib)
   - **Jabatan** (wajib untuk PIC)
   - **NIP** (wajib untuk PIC)
   - **No. HP** (wajib untuk PIC)
   - **NIK KTP** (wajib untuk PIC)
   - **Email** (wajib, akan digunakan sebagai username login)
   - **Password** (wajib, minimal satu karakter)
   - **Role** — pilih **pic**
   - **District** — pilih district yang sesuai (hanya district dalam area verifikator yang tersedia)
   - **Scan KTP** — unggah file scan KTP (wajib saat membuat akun baru)
3. Tekan **Simpan**.

**Mengedit akun PIC yang sudah ada:**

1. Temukan akun di tabel daftar pengguna.
2. Tekan **Edit** di kolom aksi.
3. Ubah data yang perlu diperbarui (nama, jabatan, NIP, no. HP, NIK KTP, district, atau password baru).
4. Tekan **Simpan**.

> Verifikator hanya dapat melihat dan mengelola akun PIC dan Verifikator dalam area yang sama. Tidak dapat menambah atau mengubah akun Pusat.

---

## BAGIAN 3 — PANDUAN AKUN PUSAT (ADMIN)

Akun Pusat memiliki akses ke seluruh data dan konfigurasi sistem. Menu tambahan yang tersedia di bilah navigasi: **Engine AI**, **backup/restore**, **Manage District**, **Manage Group View**, dan **Manage Users**.

---

### 3.1 Dashboard — Tampilan Lintas Seluruh Area

Akun Pusat mendapatkan filter tambahan:

- **Filter Region** — menyaring berdasarkan regional operasional.
- **Filter Area** — menyaring berdasarkan area dalam region terpilih.
- **Filter District** — menyaring berdasarkan district.

Pilih kombinasi filter untuk melihat rekapitulasi kegiatan dari seluruh wilayah.

---

### 3.2 Manage District (Region, Area, District)

Akses melalui menu **Manage District**.

Halaman ini memiliki tiga tab: **Region**, **Area**, dan **District**.

**Menambah Region:**
1. Pilih tab **Region**.
2. Ketik nama region baru di kolom input.
3. Tekan **Buat**.

**Mengedit Region:**
1. Tekan **Edit** di samping nama region.
2. Ubah nama.
3. Tekan **Simpan**.

**Menambah Area:**
1. Pilih tab **Area**.
2. Pilih **Region** induk dari dropdown.
3. Ketik nama area baru.
4. Tekan **Buat**.

**Mengedit Area:**
1. Setelah memilih Region, daftar area akan muncul.
2. Tekan **Edit** di samping nama area.
3. Ubah nama.
4. Tekan **Simpan**.

**Menambah District:**
1. Pilih tab **District**.
2. Pilih **Region** lalu pilih **Area** yang menjadi induk district.
3. Ketik nama district baru.
4. Tekan **Buat**.

**Mengedit District:**
1. Setelah memilih Region dan Area, daftar district akan muncul.
2. Tekan **Edit** di samping nama district.
3. Ubah nama.
4. Tekan **Simpan**.

> Menghapus region/area/district akan memunculkan konfirmasi terlebih dahulu.

---

### 3.3 Manage Group View

Akses melalui menu **Manage Group View**.

**Menambah Group View:**
1. Ketik nama kategori baru di kolom input.
2. Tekan **Buat**.

**Mengedit Group View:**
1. Tekan **Edit** di samping nama yang ingin diubah.
2. Masukkan nama baru.
3. Tekan **Simpan**.

**Menghapus Group View:**
1. Tekan **Hapus** di samping nama.
2. Konfirmasi penghapusan.

---

### 3.4 Manage Users

Akses melalui menu **Manage Users**.

Akun Pusat dapat menambah dan mengelola akun untuk seluruh role: **PIC**, **Verifikator**, maupun **Pusat** lainnya.

**Menambah akun Verifikator:**
1. Isi formulir Tambah Pengguna.
2. Pada field **Role**, pilih **verifikator**.
3. Pilih **Region** dan **Area** yang menjadi tanggung jawab verifikator tersebut.
4. Isi email dan password.
5. Tekan **Simpan**.

**Menambah akun PIC:**
1. Isi formulir lengkap (nama, jabatan, NIP, no. HP, NIK KTP, scan KTP).
2. Pilih **Role** = **pic**.
3. Pilih **Region**, **Area**, dan **District** PIC tersebut.
4. Isi email dan password.
5. Tekan **Simpan**.

**Menambah akun Pusat:**
1. Isi formulir (nama wajib, email, password).
2. Pilih **Role** = **pusat**.
3. Tekan **Simpan** (tidak perlu memilih region/area/district).

**Mengedit pengguna:**
1. Temukan akun di tabel.
2. Tekan **Edit**.
3. Ubah data yang diperlukan (termasuk password baru jika ingin direset).
4. Tekan **Simpan**.

---

### 3.5 Engine AI (Ganti Script OCR)

Akses melalui menu **Engine AI**.

Halaman ini menampilkan nama **file engine aktif** yang sedang digunakan untuk membaca nota.

**Mengganti engine dengan file baru:**
1. Pastikan tombol **Upload File Engine** aktif (mode default).
2. Tekan **Pilih File** dan pilih file script Python (`.py`) yang baru.
3. Tekan **Simpan**.
4. Sistem akan langsung kembali ke Dashboard setelah berhasil.

**Menggunakan file engine yang pernah diunggah sebelumnya:**
1. Tekan tombol **Gunakan File Engine Sebelumnya**.
2. Pilih nama file dari dropdown.
3. Tekan **Simpan**.

> File engine harus berekstensi `.py`.

---

### 3.6 Backup dan Restore Data

Akses melalui menu **backup/restore**.

Halaman ini menampilkan status file backup yang tersimpan di server: nama file, ukuran, dan waktu terakhir dibuat.

> Hanya satu file backup yang disimpan di server. Backup baru akan menggantikan file backup sebelumnya.

**Membuat Backup:**
1. Tekan tombol **backup**.
2. Konfirmasi permintaan yang muncul dengan menekan **OK**.
3. File backup akan diunduh otomatis ke perangkat dengan format `.tar.gz`.
4. File backup juga tersimpan di server sebagai cadangan untuk proses restore.

Isi file backup mencakup:
- Seluruh data database (kegiatan, pengguna, dokumen, hasil OCR, dll).
- Seluruh file yang diunggah (nota, dokumentasi kegiatan, bukti pendukung, scan KTP).

**Melakukan Restore:**

> **Perhatian:** Restore akan menimpa **seluruh data yang ada saat ini** dengan data dari file backup. Lakukan dengan hati-hati.

1. Pastikan file backup sudah tersedia (status "Tersedia" pada halaman backup/restore).
2. Tekan tombol **restore**.
3. Konfirmasi permintaan yang muncul dengan menekan **OK**.
4. Tunggu hingga muncul notifikasi "Restore berhasil".
5. Refresh halaman browser setelah restore selesai.

**Skenario migrasi ke server baru:**
1. Di server lama: lakukan backup dan simpan file `.tar.gz` yang terunduh.
2. Di server baru: jalankan instalasi, migrasi database, dan seed awal.
3. Login dengan akun Pusat di server baru.
4. Unggah file backup ke server baru melalui mekanisme lain (saat ini restore hanya membaca file yang sudah ada di server; lihat catatan teknis di bawah).

> **Catatan teknis untuk administrator server:** Untuk restore dari file backup yang diunduh ke perangkat lokal, salin file tersebut ke lokasi `uploads/backups/smartopex-backup.tar.gz` di dalam container atau volume server baru sebelum menekan tombol restore.

---

## Catatan Umum

- **Sesi otomatis berakhir** setelah 15 menit tidak aktif. Login ulang diperlukan.
- **Ekspor Excel** tersedia di bagian bawah Dashboard dan mengikuti filter yang sedang aktif (region, area, district, bulan).
- Semua file yang diunggah (nota, dokumentasi, scan KTP) tersimpan di server dan dapat dibuka dengan menekan tautan/tombol **Lihat** pada masing-masing file.
