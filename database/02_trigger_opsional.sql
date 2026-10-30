-- =========================================================
-- HISADA INVENTARIS — TRIGGER PENJAGA STOK (OPSIONAL)
-- =========================================================
-- Jalankan SETELAH 01_skema.sql.
--
-- Aturan ini sama dengan yang dicek di aplikasi, tapi dijaga
-- langsung oleh database, jadi tetap aman walau ada kode PHP
-- yang lupa mengecek:
--   1. Pinjam tidak boleh melebihi sisa yang tersedia
--      (hanya kondisi Baik − yang sedang dipinjam).
--   2. Bagian, kode, dan nama barang di peminjaman otomatis
--      diisi dari data barangnya.
--   3. Barang yang masih dipinjam tidak bisa dihapus atau
--      dipindah bagian, dan jumlah Baik-nya tidak bisa
--      diturunkan di bawah jumlah yang dipinjam.
--
-- Kalau hosting menolak trigger (error "TRIGGER command denied"
-- atau "SUPER privilege"), lewati file ini. Aturannya tetap
-- dijalankan oleh aplikasi.
-- =========================================================

DROP TRIGGER IF EXISTS trg_peminjaman_sebelum_tambah;
DROP TRIGGER IF EXISTS trg_peminjaman_sebelum_ubah;
DROP TRIGGER IF EXISTS trg_barang_sebelum_ubah;
DROP TRIGGER IF EXISTS trg_barang_sebelum_hapus;

DELIMITER $$

CREATE TRIGGER trg_peminjaman_sebelum_tambah
BEFORE INSERT ON peminjaman
FOR EACH ROW
BEGIN
  DECLARE v_bagian    TINYINT UNSIGNED;
  DECLARE v_kode      VARCHAR(12);
  DECLARE v_nama      VARCHAR(150);
  DECLARE v_bisa      INT;
  DECLARE v_dipinjam  INT;

  IF NEW.barang_id IS NOT NULL THEN
    SELECT bagian_id, kode, nama,
           jumlah_baik
      INTO v_bagian, v_kode, v_nama, v_bisa
      FROM barang
     WHERE id = NEW.barang_id
       FOR UPDATE;

    SET NEW.bagian_id   = v_bagian;
    SET NEW.kode_barang = v_kode;
    SET NEW.nama_barang = v_nama;

    IF NEW.status = 'Dipinjam' THEN
      SELECT COALESCE(SUM(jumlah), 0)
        INTO v_dipinjam
        FROM peminjaman
       WHERE barang_id = NEW.barang_id
         AND status = 'Dipinjam';

      IF NEW.jumlah > v_bisa - v_dipinjam THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Stok tidak cukup untuk dipinjam.';
      END IF;
    END IF;
  END IF;
END$$


CREATE TRIGGER trg_peminjaman_sebelum_ubah
BEFORE UPDATE ON peminjaman
FOR EACH ROW
BEGIN
  DECLARE v_bagian    TINYINT UNSIGNED;
  DECLARE v_kode      VARCHAR(12);
  DECLARE v_nama      VARCHAR(150);
  DECLARE v_bisa      INT;
  DECLARE v_dipinjam  INT;

  -- Hanya cek kalau barang/jumlah/status berubah,
  -- supaya barang yang sudah dihapus (barang_id jadi NULL)
  -- tidak memicu error
  IF NEW.barang_id IS NOT NULL AND (
       NOT (NEW.barang_id <=> OLD.barang_id) OR
       NEW.jumlah <> OLD.jumlah OR
       NEW.status <> OLD.status
     ) THEN
    SELECT bagian_id, kode, nama,
           jumlah_baik
      INTO v_bagian, v_kode, v_nama, v_bisa
      FROM barang
     WHERE id = NEW.barang_id
       FOR UPDATE;

    SET NEW.bagian_id   = v_bagian;
    SET NEW.kode_barang = v_kode;
    SET NEW.nama_barang = v_nama;

    IF NEW.status = 'Dipinjam' THEN
      SELECT COALESCE(SUM(jumlah), 0)
        INTO v_dipinjam
        FROM peminjaman
       WHERE barang_id = NEW.barang_id
         AND status = 'Dipinjam'
         AND id <> OLD.id;

      IF NEW.jumlah > v_bisa - v_dipinjam THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Stok tidak cukup untuk dipinjam.';
      END IF;
    END IF;
  END IF;
END$$


CREATE TRIGGER trg_barang_sebelum_ubah
BEFORE UPDATE ON barang
FOR EACH ROW
BEGIN
  DECLARE v_dipinjam INT;

  SELECT COALESCE(SUM(jumlah), 0)
    INTO v_dipinjam
    FROM peminjaman
   WHERE barang_id = OLD.id
     AND status = 'Dipinjam';

  IF v_dipinjam > 0 AND NEW.bagian_id <> OLD.bagian_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Barang masih dipinjam, kembalikan dulu sebelum pindah bagian.';
  END IF;

  IF NEW.jumlah_baik < v_dipinjam THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Jumlah Baik tidak boleh kurang dari jumlah yang dipinjam.';
  END IF;
END$$


CREATE TRIGGER trg_barang_sebelum_hapus
BEFORE DELETE ON barang
FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1
      FROM peminjaman
     WHERE barang_id = OLD.id
       AND status = 'Dipinjam'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Barang masih dipinjam, kembalikan dulu sebelum dihapus.';
  END IF;
END$$

DELIMITER ;
