-- =========================================================
-- HISADA INVENTARIS — SKEMA DATABASE (MySQL / MariaDB)
-- =========================================================
-- Untuk: MySQL 8.0.16+ atau MariaDB 10.2+ (butuh CHECK).
-- Cara pakai: phpMyAdmin → pilih database → tab Import →
--             pilih file ini → Go.
--
-- Struktur ini mengikuti data aplikasi (script.js):
--   bagian      ← daftar DEPTS
--   akun        ← hisada_admin_v4 + hisada_users_v4
--   barang      ← hisada_items_v4
--   peminjaman  ← hisada_loans_v4
--
-- Catatan:
-- * Tidak ada akun Admin bawaan. Admin dibuat lewat halaman
--   "Buat Akun Admin" di aplikasi (PHP), jadi tidak ada
--   password yang tertulis di file ini.
-- * Password disimpan dengan password_hash() dari PHP
--   (bcrypt, ±60 karakter), bukan teks aslinya.
-- * Semua waktu dalam WIB. Di PHP, setelah terhubung ke
--   database, jalankan:  SET time_zone = '+07:00';
-- =========================================================

SET NAMES utf8mb4;


-- ---------------------------------------------------------
-- 1. BAGIAN
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS bagian (
  id    TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode  CHAR(3)          NOT NULL,   -- awalan nomor barang, mis. LOG
  nama  VARCHAR(50)      NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uk_bagian_kode (kode),
  UNIQUE KEY uk_bagian_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO bagian (kode, nama) VALUES
  ('LOG', 'Logistik'),
  ('BHS', 'Bahasa'),
  ('KES', 'Kesehatan'),
  ('TMR', 'Ta''mir Masjid'),
  ('KAM', 'Keamanan'),
  ('PRM', 'Pramuka'),
  ('OLR', 'Olahraga'),
  ('DWH', 'Dewan Harian'),
  ('DAP', 'Dapur'),
  ('KSN', 'Kesenian')
ON DUPLICATE KEY UPDATE nama = VALUES(nama);


-- ---------------------------------------------------------
-- 2. AKUN (Admin + akun bagian)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS akun (
  id             INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  username       VARCHAR(50)       NOT NULL,
  password_hash  VARCHAR(255)      NOT NULL,   -- hasil password_hash()
  nama           VARCHAR(100)      NOT NULL,
  role           ENUM('admin', 'bagian') NOT NULL DEFAULT 'bagian',
  bagian_id      TINYINT UNSIGNED  NULL,       -- kosong untuk Admin
  status         ENUM('pending', 'approved', 'rejected')
                                   NOT NULL DEFAULT 'pending',
  created_at     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_akun_username (username),
  KEY idx_akun_bagian (bagian_id),

  CONSTRAINT fk_akun_bagian
    FOREIGN KEY (bagian_id) REFERENCES bagian (id),

  -- Akun bagian wajib punya bagian, Admin tidak
  CONSTRAINT ck_akun_bagian CHECK (
    (role = 'admin'  AND bagian_id IS NULL) OR
    (role = 'bagian' AND bagian_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------
-- 3. BARANG (inventaris)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS barang (
  id                  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  kode                VARCHAR(12)       NOT NULL,   -- mis. LOG-001
  bagian_id           TINYINT UNSIGNED  NOT NULL,
  nama                VARCHAR(150)      NOT NULL,
  jumlah_baik         INT UNSIGNED      NOT NULL DEFAULT 0,
  jumlah_kurang_baik  INT UNSIGNED      NOT NULL DEFAULT 0,
  jumlah_rusak_berat  INT UNSIGNED      NOT NULL DEFAULT 0,
  jumlah_hilang       INT UNSIGNED      NOT NULL DEFAULT 0,
  keterangan          TEXT              NULL,
  dibuat_oleh         INT UNSIGNED      NULL,
  diubah_oleh         INT UNSIGNED      NULL,
  created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_barang_kode (kode),
  KEY idx_barang_bagian (bagian_id),

  CONSTRAINT fk_barang_bagian
    FOREIGN KEY (bagian_id) REFERENCES bagian (id),

  CONSTRAINT fk_barang_dibuat_oleh
    FOREIGN KEY (dibuat_oleh) REFERENCES akun (id)
    ON DELETE SET NULL,

  CONSTRAINT fk_barang_diubah_oleh
    FOREIGN KEY (diubah_oleh) REFERENCES akun (id)
    ON DELETE SET NULL,

  CONSTRAINT ck_barang_nama CHECK (CHAR_LENGTH(TRIM(nama)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------
-- 4. PEMINJAMAN
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS peminjaman (
  id               INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  kode             VARCHAR(12)       NOT NULL,   -- mis. PJM-001
  barang_id        INT UNSIGNED      NULL,       -- kosong kalau barang sudah dihapus
  kode_barang      VARCHAR(12)       NULL,       -- salinan saat dipinjam
  nama_barang      VARCHAR(150)      NOT NULL,   -- salinan saat dipinjam
  bagian_id        TINYINT UNSIGNED  NOT NULL,   -- ikut bagian pemilik barang
  jumlah           INT UNSIGNED      NOT NULL,
  peminjam         VARCHAR(100)      NOT NULL,
  waktu_pinjam     DATETIME          NOT NULL,
  rencana_kembali  DATE              NULL,
  status           ENUM('Dipinjam', 'Dikembalikan')
                                     NOT NULL DEFAULT 'Dipinjam',
  waktu_kembali    DATETIME          NULL,
  keterangan       TEXT              NULL,
  dicatat_oleh     INT UNSIGNED      NULL,
  created_at       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_peminjaman_kode (kode),
  KEY idx_peminjaman_barang_status (barang_id, status),
  KEY idx_peminjaman_bagian (bagian_id),

  -- Riwayat pinjam tetap ada walau barangnya dihapus
  CONSTRAINT fk_peminjaman_barang
    FOREIGN KEY (barang_id) REFERENCES barang (id)
    ON DELETE SET NULL,

  CONSTRAINT fk_peminjaman_bagian
    FOREIGN KEY (bagian_id) REFERENCES bagian (id),

  CONSTRAINT fk_peminjaman_dicatat_oleh
    FOREIGN KEY (dicatat_oleh) REFERENCES akun (id)
    ON DELETE SET NULL,

  CONSTRAINT ck_peminjaman_jumlah CHECK (jumlah > 0),

  CONSTRAINT ck_peminjaman_rencana CHECK (
    rencana_kembali IS NULL OR
    rencana_kembali >= DATE(waktu_pinjam)
  ),

  -- Status Dikembalikan wajib punya waktu kembali
  CONSTRAINT ck_peminjaman_kembali CHECK (
    (status = 'Dipinjam'     AND waktu_kembali IS NULL) OR
    (status = 'Dikembalikan' AND waktu_kembali IS NOT NULL
                             AND waktu_kembali >= waktu_pinjam)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------
-- 5. VIEW — dipakai untuk tabel & dashboard
-- ---------------------------------------------------------

-- Stok tiap barang: total (tanpa Hilang), sedang dipinjam,
-- dan sisa yang bisa dipinjam (Baik + Kurang Baik − dipinjam)
CREATE OR REPLACE VIEW v_stok_barang AS
SELECT
  b.id,
  b.kode,
  b.nama,
  b.bagian_id,
  bg.nama AS nama_bagian,
  b.jumlah_baik,
  b.jumlah_kurang_baik,
  b.jumlah_rusak_berat,
  b.jumlah_hilang,
  b.jumlah_baik + b.jumlah_kurang_baik + b.jumlah_rusak_berat
    AS total_ada,
  COALESCE(p.dipinjam, 0) AS dipinjam,
  GREATEST(
    CAST(b.jumlah_baik + b.jumlah_kurang_baik AS SIGNED)
      - COALESCE(p.dipinjam, 0),
    0
  ) AS tersedia,
  b.keterangan,
  b.updated_at
FROM barang b
JOIN bagian bg ON bg.id = b.bagian_id
LEFT JOIN (
  SELECT barang_id, SUM(jumlah) AS dipinjam
  FROM peminjaman
  WHERE status = 'Dipinjam'
  GROUP BY barang_id
) p ON p.barang_id = b.id;

-- Ringkasan per bagian untuk Dashboard
CREATE OR REPLACE VIEW v_ringkasan_bagian AS
SELECT
  bg.id   AS bagian_id,
  bg.kode,
  bg.nama AS nama_bagian,
  COUNT(b.id)                               AS jenis_barang,
  COALESCE(SUM(b.jumlah_baik), 0)           AS baik,
  COALESCE(SUM(b.jumlah_kurang_baik), 0)    AS kurang_baik,
  COALESCE(SUM(b.jumlah_rusak_berat), 0)    AS rusak_berat,
  COALESCE(SUM(b.jumlah_hilang), 0)         AS hilang,
  COALESCE(SUM(
    b.jumlah_baik + b.jumlah_kurang_baik + b.jumlah_rusak_berat
  ), 0)                                     AS total_ada
FROM bagian bg
LEFT JOIN barang b ON b.bagian_id = bg.id
GROUP BY bg.id, bg.kode, bg.nama;
