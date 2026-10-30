# Cara Pasang — HISADA Inventaris (PHP + MySQL)

Versi ini menyimpan semua data di **database MySQL di server**, bukan di browser. Jadi semua bagian bisa memakai HP/laptop masing-masing, dan Admin melihat data semuanya.

> GitHub Pages **tidak bisa** menjalankan PHP. Versi ini harus dipasang di hosting yang mendukung PHP + MySQL (cPanel, server pondok) atau XAMPP untuk uji.

## Kebutuhan
- PHP 7.4 atau lebih baru, dengan ekstensi `pdo_mysql` dan `mbstring` (biasanya sudah ada)
- MySQL 8.0.16+ atau MariaDB 10.2+

## Isi folder

```
index.html, style.css, script.js, animasi.js, image1.png   ← tampilan
api/index.php            ← semua aksi (login, barang, pinjam, akun)
api/inti.php             ← fungsi dasar (database, session)
api/dokumentasi.php      ← upload & tampil bukti (foto/PDF/link)
api/config.example.php   ← contoh pengaturan database
database/01_skema.sql    ← tabel & view
database/02_trigger_opsional.sql ← penjaga stok tambahan (opsional)
database/03_dokumentasi.sql      ← tabel bukti / dokumentasi
uploads/                 ← dibuat otomatis saat bukti pertama di-upload
```

## Langkah di cPanel

1. **Buat database.** cPanel → *MySQL® Databases* → buat database (mis. `hisada_inventaris`) dan user-nya, lalu tambahkan user ke database dengan *ALL PRIVILEGES*.
2. **Impor tabel.** cPanel → *phpMyAdmin* → pilih database tadi → tab **Import** → pilih `database/01_skema.sql` → **Go**. Ulangi untuk `02_trigger_opsional.sql`, lalu `03_dokumentasi.sql`. Kalau `02` ditolak (error *TRIGGER* / *SUPER privilege*), lewati saja, karena aturan stok tetap dijaga oleh PHP. `03` wajib diimpor untuk fitur bukti.
3. **Upload file.** cPanel → *File Manager* → `public_html` (atau subfolder, mis. `public_html/inventaris`). Upload semua file dan folder di atas.
4. **Atur koneksi.** Di folder `api/`, salin `config.example.php` menjadi **`config.php`**, lalu isi nama database, user, dan password dari langkah 1. Kalau website sudah memakai `https`, ubah `cookie_secure` menjadi `true`.
5. **Buka website.** Yang pertama muncul adalah layar **Buat Akun Admin**. Buat admin, lalu login.

## Uji di XAMPP (laptop)

1. Nyalakan **Apache** dan **MySQL** di XAMPP Control Panel.
2. Salin folder ini ke `C:\xampp\htdocs\hisada`.
3. Buka `http://localhost/phpmyadmin`, buat database `hisada_inventaris`, lalu impor ketiga file SQL secara berurutan (`01`, `02`, `03`).
4. Salin `api/config.example.php` → `api/config.php` (isi bawaannya sudah cocok untuk XAMPP: user `root`, password kosong).
5. Buka `http://localhost/hisada`.

## Dokumentasi / bukti

- **Barang:** foto (JPG/PNG/WebP). **Peminjaman:** foto, PDF, atau link (Google Drive, dll.). Maksimal 2 MB per file. Foto otomatis dikecilkan di browser sebelum di-upload.
- Setiap bukti punya **tanggal dokumentasi** (bisa diubah, tidak boleh setelah hari ini), keterangan, serta nama pengunggah dan waktu upload yang tercatat otomatis.
- File disimpan di folder `uploads/` dan **tidak bisa dibuka langsung**. File hanya bisa dibuka setelah login, dan hanya oleh bagian pemiliknya atau Admin.
- Bukti ikut terhapus kalau barang atau peminjamannya dihapus.
- **Sudah memasang versi sebelumnya?** Cukup impor `database/03_dokumentasi.sql` (data lama tidak berubah), lalu upload `index.html`, `script.js`, `style.css`, dan folder `api/` yang baru.
- Kalau upload selalu gagal: pastikan folder aplikasi bisa ditulisi (izin 755), dan `upload_max_filesize` PHP di cPanel (*Select PHP Version → Options*) minimal `2M`.

## Aturan stok

- **Total** = Baik + Kurang Baik + Rusak Berat + Hilang (jumlah keseluruhan yang tercatat).
- **Bisa dipinjam** = hanya kondisi **Baik**, dikurangi yang sedang dipinjam.
- **Memperbarui dari versi sebelumnya?** Impor ulang `database/01_skema.sql` dan `02_trigger_opsional.sql` di phpMyAdmin supaya view dan trigger memakai aturan ini. Data barang, akun, dan peminjaman tidak berubah.

## Keamanan

- **`api/config.php` berisi password database.** Jangan di-upload ke GitHub, karena sudah masuk `.gitignore`.
- Password akun disimpan dengan `password_hash()` (bcrypt), tidak bisa dibaca siapa pun termasuk Admin.
- Login memakai cookie session `HttpOnly`, sehingga tidak bisa dicuri lewat JavaScript.
- Setiap aksi dicek di server: akun bagian hanya bisa melihat dan mengubah data bagiannya sendiri, walaupun ada yang mencoba memanggil API langsung.
- File `.htaccess` mencegah file SQL dan `config.php` dibuka dari browser (berlaku di Apache/cPanel).
- **Pakai https** di hosting (cPanel biasanya menyediakan SSL gratis lewat *AutoSSL*).

## Lupa password Admin

Buka phpMyAdmin → tabel `akun` → hapus baris yang `role`-nya `admin`. Buka website lagi, maka layar **Buat Akun Admin** akan muncul kembali. Data barang dan peminjaman tidak ikut terhapus.

## Data lama

Data yang sekarang ada di versi GitHub Pages tersimpan di browser masing-masing (localStorage), jadi **tidak otomatis pindah** ke database. Barang perlu diinput ulang, atau dibuat fitur impor terpisah.
