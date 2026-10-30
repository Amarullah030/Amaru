-- =========================================================
-- HISADA INVENTARIS — DOKUMENTASI / BUKTI (MySQL / MariaDB)
-- =========================================================
-- Jalankan SETELAH 01_skema.sql (boleh juga untuk database
-- yang sudah berisi data — tabel lama tidak diubah).
--
-- Satu baris = satu bukti:
--   * Barang     → foto (upload)
--   * Peminjaman → foto / PDF (upload) atau link (Drive, dll.)
--
-- File upload disimpan di folder uploads/ di hosting; tabel ini
-- hanya menyimpan lokasi dan keterangannya.
-- =========================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS dokumentasi (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,

  -- Bukti milik barang ATAU peminjaman (salah satu diisi;
  -- dicek di PHP, karena MySQL tidak mengizinkan CHECK pada
  -- kolom foreign key yang memakai ON DELETE CASCADE)
  barang_id      INT UNSIGNED  NULL,
  peminjaman_id  INT UNSIGNED  NULL,

  tipe           ENUM('gambar', 'file', 'link') NOT NULL,

  -- Untuk upload
  lokasi_file    VARCHAR(255)  NULL,   -- mis. 2026/10/3f9a...c1.jpg
  nama_asli      VARCHAR(255)  NULL,   -- nama file dari pengunggah
  mime           VARCHAR(50)   NULL,   -- image/jpeg, application/pdf
  ukuran         INT UNSIGNED  NULL,   -- byte

  -- Untuk link
  url            VARCHAR(500)  NULL,

  tanggal        DATE          NOT NULL,  -- tanggal dokumentasi (diisi)
  keterangan     VARCHAR(255)  NULL,
  diunggah_oleh  INT UNSIGNED  NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- otomatis

  PRIMARY KEY (id),
  KEY idx_dok_barang (barang_id, tanggal),
  KEY idx_dok_peminjaman (peminjaman_id, tanggal),

  -- Barang / peminjaman dihapus → buktinya ikut terhapus
  CONSTRAINT fk_dok_barang
    FOREIGN KEY (barang_id) REFERENCES barang (id)
    ON DELETE CASCADE,

  CONSTRAINT fk_dok_peminjaman
    FOREIGN KEY (peminjaman_id) REFERENCES peminjaman (id)
    ON DELETE CASCADE,

  CONSTRAINT fk_dok_diunggah_oleh
    FOREIGN KEY (diunggah_oleh) REFERENCES akun (id)
    ON DELETE SET NULL,

  -- Upload wajib punya lokasi file, link wajib punya url
  CONSTRAINT ck_dok_isi CHECK (
    (tipe IN ('gambar', 'file') AND lokasi_file IS NOT NULL AND url IS NULL) OR
    (tipe = 'link' AND url IS NOT NULL AND lokasi_file IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
