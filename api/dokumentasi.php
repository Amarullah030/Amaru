<?php
/* =========================================================
   DOKUMENTASI / BUKTI
   ---------------------------------------------------------
   Barang     → foto (upload)
   Peminjaman → foto / PDF (upload) atau link
   File disimpan di folder uploads/ dan hanya bisa dibuka
   lewat api/?aksi=file (dicek login & bagian).
   ========================================================= */

declare(strict_types=1);

const MAKS_UKURAN_BUKTI = 2 * 1024 * 1024;   // 2 MB per file


function folder_upload(): string
{
    $folder = config()['upload_dir'] ?? dirname(__DIR__) . '/uploads';

    if (!is_dir($folder) && !mkdir($folder, 0755, true)) {
        gagal('Folder uploads tidak bisa dibuat. Cek izin folder di hosting.', 500);
    }

    /* File tidak boleh dibuka langsung dari browser */
    $htaccess = $folder . '/.htaccess';

    if (!is_file($htaccess)) {
        file_put_contents($htaccess, "Require all denied\n");
    }

    return $folder;
}

/* Lokasi file bukti milik satu barang / peminjaman */
function file_bukti(string $kolom, int $id): array
{
    if (!in_array($kolom, ['barang_id', 'peminjaman_id'], true)) {
        return [];
    }

    return array_column(
        semua(
            "SELECT lokasi_file FROM dokumentasi
              WHERE $kolom = ? AND lokasi_file IS NOT NULL",
            [$id]
        ),
        'lokasi_file'
    );
}

function hapus_file_bukti(array $daftar): void
{
    foreach ($daftar as $lokasi) {
        $path = folder_upload() . '/' . $lokasi;

        if (is_file($path)) {
            @unlink($path);
        }
    }
}

/* Jenis file dibaca dari isi file, bukan dari nama file */
function jenis_file(string $path): ?array
{
    $awal = (string) file_get_contents($path, false, null, 0, 12);

    if (strncmp($awal, "\xFF\xD8\xFF", 3) === 0) {
        return ['image/jpeg', 'jpg', 'gambar'];
    }

    if (strncmp($awal, "\x89PNG\r\n\x1A\n", 8) === 0) {
        return ['image/png', 'png', 'gambar'];
    }

    if (substr($awal, 0, 4) === 'RIFF' && substr($awal, 8, 4) === 'WEBP') {
        return ['image/webp', 'webp', 'gambar'];
    }

    if (strncmp($awal, '%PDF-', 5) === 0) {
        return ['application/pdf', 'pdf', 'file'];
    }

    return null;
}

/* Barang / peminjaman yang akan diberi bukti + cek akses */
function induk_bukti(array $akun, string $jenis, int $id): array
{
    if ($jenis === 'barang') {
        $induk = satu('SELECT id, bagian_id FROM barang WHERE id = ?', [$id]);
    } elseif ($jenis === 'peminjaman') {
        $induk = satu('SELECT id, bagian_id FROM peminjaman WHERE id = ?', [$id]);
    } else {
        gagal('Jenis bukti tidak valid.');
    }

    if (!$induk) {
        gagal('Data tidak ditemukan.');
    }

    if (!boleh_akses_bagian($akun, (int) $induk['bagian_id'])) {
        gagal('Akses ditolak.', 403);
    }

    return $induk;
}

/* Tambah bukti: upload file (multipart) atau link */
function aksi_dok_tambah(): void
{
    $akun = wajib_login();

    $jenis = (string) ($_POST['parentType'] ?? '');
    $id    = (int) ($_POST['parentId'] ?? 0);
    $cara  = (string) ($_POST['kind'] ?? 'upload');
    $ket   = mb_substr(trim((string) ($_POST['note'] ?? '')), 0, 255);
    $tgl   = tanggal_db((string) ($_POST['date'] ?? ''));

    induk_bukti($akun, $jenis, $id);

    if (!$tgl) {
        gagal('Tanggal dokumentasi wajib diisi.');
    }

    if ($tgl > date('Y-m-d')) {
        gagal('Tanggal dokumentasi tidak boleh setelah hari ini.');
    }

    $kolom = $jenis === 'barang' ? 'barang_id' : 'peminjaman_id';

    /* ---------- Link (hanya untuk peminjaman) ---------- */
    if ($cara === 'link') {
        if ($jenis !== 'peminjaman') {
            gagal('Bukti barang harus berupa foto.');
        }

        $url = trim((string) ($_POST['url'] ?? ''));

        if (
            mb_strlen($url) > 500 ||
            !filter_var($url, FILTER_VALIDATE_URL) ||
            !preg_match('#^https?://#i', $url)
        ) {
            gagal('Link tidak valid. Harus diawali http:// atau https://');
        }

        query(
            "INSERT INTO dokumentasi
               ($kolom, tipe, url, tanggal, keterangan, diunggah_oleh)
             VALUES (?, 'link', ?, ?, ?, ?)",
            [$id, $url, $tgl, $ket, $akun['id']]
        );

        berhasil();
    }

    /* ---------- Upload file ---------- */
    $file = $_FILES['file'] ?? null;

    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        gagal('Pilih file bukti dulu.');
    }

    if (
        in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ||
        $file['size'] > MAKS_UKURAN_BUKTI
    ) {
        gagal('File terlalu besar. Maksimal 2 MB.');
    }

    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        gagal('Upload gagal. Coba lagi.');
    }

    $info = jenis_file($file['tmp_name']);

    if (!$info) {
        gagal('Jenis file tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.');
    }

    [$mime, $ext, $tipe] = $info;

    if ($jenis === 'barang' && $tipe !== 'gambar') {
        gagal('Bukti barang harus berupa foto (JPG, PNG, atau WebP).');
    }

    /* Gambar harus benar-benar bisa dibaca sebagai gambar */
    if ($tipe === 'gambar' && !@getimagesize($file['tmp_name'])) {
        gagal('File gambar rusak atau tidak valid.');
    }

    /* Nama acak, dikelompokkan per tahun/bulan */
    $sub    = date('Y/m');
    $folder = folder_upload() . '/' . $sub;

    if (!is_dir($folder) && !mkdir($folder, 0755, true)) {
        gagal('Folder uploads tidak bisa dibuat. Cek izin folder di hosting.', 500);
    }

    $lokasi = $sub . '/' . bin2hex(random_bytes(16)) . '.' . $ext;

    if (!move_uploaded_file($file['tmp_name'], folder_upload() . '/' . $lokasi)) {
        gagal('File tidak bisa disimpan di server.', 500);
    }

    $nama_asli = mb_substr(basename((string) $file['name']), 0, 255);

    try {
        query(
            "INSERT INTO dokumentasi
               ($kolom, tipe, lokasi_file, nama_asli, mime, ukuran,
                tanggal, keterangan, diunggah_oleh)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [$id, $tipe, $lokasi, $nama_asli, $mime, (int) $file['size'], $tgl, $ket, $akun['id']]
        );
    } catch (Throwable $e) {
        /* Data gagal disimpan → jangan tinggalkan file yatim */
        hapus_file_bukti([$lokasi]);
        throw $e;
    }

    berhasil();
}

/* Bukti beserta cek akses lewat barang / peminjamannya */
function ambil_bukti(array $akun, int $id): array
{
    $dok = satu(
        'SELECT d.*, COALESCE(b.bagian_id, p.bagian_id) AS bagian_id
           FROM dokumentasi d
      LEFT JOIN barang b     ON b.id = d.barang_id
      LEFT JOIN peminjaman p ON p.id = d.peminjaman_id
          WHERE d.id = ?',
        [$id]
    );

    if (!$dok) {
        gagal('Bukti tidak ditemukan.', 404);
    }

    if (!boleh_akses_bagian($akun, (int) $dok['bagian_id'])) {
        gagal('Akses ditolak.', 403);
    }

    return $dok;
}

function aksi_dok_hapus(): void
{
    $akun = wajib_login();
    $dok  = ambil_bukti($akun, angka('id'));

    query('DELETE FROM dokumentasi WHERE id = ?', [$dok['id']]);

    if ($dok['lokasi_file']) {
        hapus_file_bukti([$dok['lokasi_file']]);
    }

    berhasil();
}

/* Tampilkan file bukti (gambar / PDF) */
function aksi_file(): void
{
    $akun = wajib_login();
    $dok  = ambil_bukti($akun, (int) ($_GET['id'] ?? 0));

    $path = $dok['lokasi_file']
        ? folder_upload() . '/' . $dok['lokasi_file']
        : '';

    if (!$path || !is_file($path)) {
        gagal('File tidak ditemukan.', 404);
    }

    $nama = str_replace(['"', "\r", "\n"], '', (string) $dok['nama_asli']);

    header('Content-Type: ' . $dok['mime']);
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: inline; filename="' . $nama . '"');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=86400');

    readfile($path);
    exit;
}
