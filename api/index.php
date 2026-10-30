<?php
/* =========================================================
   API HISADA INVENTARIS
   ---------------------------------------------------------
   Dipanggil oleh script.js:  api/?aksi=nama_aksi
   GET  : status, data, file
   POST : setup_admin, login, logout, daftar,
          barang_simpan, barang_hapus,
          pinjam_simpan, pinjam_kembali, pinjam_hapus,
          akun_status, dok_tambah, dok_hapus
   ========================================================= */

declare(strict_types=1);

require __DIR__ . '/inti.php';
require __DIR__ . '/dokumentasi.php';

/* Error tak terduga → pesan rapi, detail hanya di log server */
set_exception_handler(function (Throwable $e) {
    if ($e instanceof PDOException) {
        $state = $e->errorInfo[0] ?? '';

        /* Pesan dari trigger (02_trigger_opsional.sql) */
        if ($state === '45000') {
            gagal((string) ($e->errorInfo[2] ?? 'Data ditolak database.'));
        }

        /* Melanggar UNIQUE / FOREIGN KEY / CHECK */
        /* 4025 = CHECK di MariaDB, 3819 = CHECK di MySQL 8 */
        if ($state === '23000' || in_array($e->errorInfo[1] ?? 0, [4025, 3819], true)) {
            gagal('Data tidak valid atau sudah ada.');
        }
    }

    error_log('[HISADA] ' . $e);
    gagal('Terjadi kesalahan di server.', 500);
});

mulai_session();

$aksi   = (string) ($_GET['aksi'] ?? '');
$metode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$aksi_get  = ['status', 'data', 'file'];
$aksi_post = [
    'setup_admin', 'login', 'logout', 'daftar',
    'barang_simpan', 'barang_hapus',
    'pinjam_simpan', 'pinjam_kembali', 'pinjam_hapus',
    'akun_status',
    'dok_tambah', 'dok_hapus',
];

if (in_array($aksi, $aksi_get, true)) {
    if ($metode !== 'GET') {
        gagal('Metode tidak diizinkan.', 405);
    }
} elseif (in_array($aksi, $aksi_post, true)) {
    /* Header khusus ini hanya bisa dikirim script.js dari website
       sendiri, jadi situs lain tidak bisa memalsukan permintaan */
    if ($metode !== 'POST' || ($_SERVER['HTTP_X_HISADA'] ?? '') !== '1') {
        gagal('Permintaan ditolak.', 403);
    }
} else {
    gagal('Aksi tidak dikenal.', 404);
}

$fungsi = 'aksi_' . $aksi;
$fungsi();


/* =========================================================
   BENTUK DATA (sama dengan nama field di script.js)
   ========================================================= */

function akun_publik(?array $a): ?array
{
    if (!$a) {
        return null;
    }

    return [
        'id'         => (string) $a['id'],
        'username'   => $a['username'],
        'name'       => $a['nama'],
        'role'       => $a['role'],
        'department' => $a['bagian'] ?? '',
    ];
}

function barang_publik(array $b): array
{
    return [
        'id'          => (string) $b['id'],
        'code'        => $b['kode'],
        'department'  => $b['bagian'],
        'name'        => $b['nama'],
        'good'        => (int) $b['jumlah_baik'],
        'fair'        => (int) $b['jumlah_kurang_baik'],
        'bad'         => (int) $b['jumlah_rusak_berat'],
        'lost'        => (int) $b['jumlah_hilang'],
        'description' => $b['keterangan'] ?? '',
        'createdAt'   => waktu_js($b['created_at']),
        'updatedAt'   => waktu_js($b['updated_at']),
    ];
}

function pinjam_publik(array $p): array
{
    return [
        'id'         => (string) $p['id'],
        'code'       => $p['kode'],
        'itemId'     => $p['barang_id'] === null ? null : (string) $p['barang_id'],
        'itemCode'   => $p['kode_barang'] ?? '',
        'itemName'   => $p['nama_barang'],
        'quantity'   => (int) $p['jumlah'],
        'borrower'   => $p['peminjam'],
        'borrowDate' => waktu_js($p['waktu_pinjam']),
        'returnPlan' => $p['rencana_kembali'] ?? '',
        'department' => $p['bagian'],
        'status'     => $p['status'],
        'note'       => $p['keterangan'] ?? '',
        'returnedAt' => waktu_js($p['waktu_kembali']),
    ];
}


function dok_publik(array $d): array
{
    return [
        'id'         => (string) $d['id'],
        'parentType' => $d['barang_id'] !== null ? 'barang' : 'peminjaman',
        'parentId'   => (string) ($d['barang_id'] ?? $d['peminjaman_id']),
        'type'       => $d['tipe'],
        'fileName'   => $d['nama_asli'] ?? '',
        'size'       => $d['ukuran'] === null ? null : (int) $d['ukuran'],
        'mime'       => $d['mime'] ?? '',
        /* File dibuka lewat API (dicek login & bagian) */
        'url'        => $d['tipe'] === 'link'
            ? $d['url']
            : 'api/?aksi=file&id=' . $d['id'],
        'date'       => $d['tanggal'],
        'note'       => $d['keterangan'] ?? '',
        'uploadedBy' => $d['pengunggah'] ?? '-',
        'createdAt'  => waktu_js($d['created_at']),
    ];
}


/* =========================================================
   STATUS & AKUN
   ========================================================= */

function ada_admin(): bool
{
    return (bool) satu("SELECT 1 FROM akun WHERE role = 'admin' LIMIT 1");
}

function aksi_status(): void
{
    berhasil([
        'adaAdmin' => ada_admin(),
        'akun'     => akun_publik(akun_login()),
    ]);
}

function aksi_setup_admin(): void
{
    $username = teks('username', 50);
    $password = (string) (input()['password'] ?? '');
    $ulang    = (string) (input()['confirm'] ?? '');

    if ($username === '') {
        gagal('Username wajib diisi.');
    }

    if (mb_strlen($password) < 8) {
        gagal('Password minimal 8 karakter.');
    }

    if ($password !== $ulang) {
        gagal('Ulangi password tidak sama.');
    }

    transaksi(function () use ($username, $password) {
        /* Dikunci supaya dua orang tidak membuat admin bersamaan */
        if (satu("SELECT id FROM akun WHERE role = 'admin' LIMIT 1 FOR UPDATE")) {
            gagal('Akun Admin sudah ada.');
        }

        if (satu('SELECT id FROM akun WHERE username = ?', [$username])) {
            gagal('Username sudah dipakai akun bagian.');
        }

        query(
            "INSERT INTO akun (username, password_hash, nama, role, status)
             VALUES (?, ?, 'Admin HISADA', 'admin', 'approved')",
            [$username, password_hash($password, PASSWORD_DEFAULT)]
        );
    });

    berhasil(['pesan' => 'Akun Admin berhasil dibuat. Silakan login.']);
}

function aksi_login(): void
{
    $username = teks('username', 50);
    $password = (string) (input()['password'] ?? '');

    $akun = satu('SELECT * FROM akun WHERE username = ?', [$username]);

    if (!$akun) {
        gagal('Username tidak ditemukan.');
    }

    if (!password_verify($password, $akun['password_hash'])) {
        gagal('Password salah.');
    }

    if ($akun['status'] !== 'approved') {
        gagal(
            $akun['status'] === 'pending'
                ? 'Akun masih menunggu persetujuan Admin.'
                : 'Akun tidak disetujui.'
        );
    }

    if (password_needs_rehash($akun['password_hash'], PASSWORD_DEFAULT)) {
        query(
            'UPDATE akun SET password_hash = ? WHERE id = ?',
            [password_hash($password, PASSWORD_DEFAULT), $akun['id']]
        );
    }

    /* ID session baru setiap login */
    session_regenerate_id(true);
    $_SESSION['akun_id'] = (int) $akun['id'];

    berhasil(['akun' => akun_publik(akun_login())]);
}

function aksi_logout(): void
{
    $_SESSION = [];
    session_destroy();

    berhasil();
}

function aksi_daftar(): void
{
    $nama     = teks('name', 100);
    $username = teks('username', 50);
    $password = (string) (input()['password'] ?? '');
    $bagian   = teks('department', 50);

    if ($nama === '' || $username === '' || $password === '' || $bagian === '') {
        gagal('Semua data harus diisi.');
    }

    $baris = satu('SELECT id FROM bagian WHERE nama = ?', [$bagian]);

    if (!$baris) {
        gagal('Bagian tidak valid.');
    }

    $lama = satu('SELECT role FROM akun WHERE username = ?', [$username]);

    if ($lama) {
        gagal(
            $lama['role'] === 'admin'
                ? 'Username tersebut khusus Admin.'
                : 'Username sudah digunakan.'
        );
    }

    query(
        "INSERT INTO akun (username, password_hash, nama, role, bagian_id, status)
         VALUES (?, ?, ?, 'bagian', ?, 'pending')",
        [$username, password_hash($password, PASSWORD_DEFAULT), $nama, $baris['id']]
    );

    berhasil(['pesan' => 'Pendaftaran berhasil. Tunggu persetujuan Admin.']);
}

function aksi_akun_status(): void
{
    wajib_admin();

    $id     = angka('id');
    $status = teks('status', 20);

    if (!in_array($status, ['approved', 'rejected'], true)) {
        gagal('Status tidak valid.');
    }

    $hasil = query(
        "UPDATE akun SET status = ? WHERE id = ? AND role = 'bagian'",
        [$status, $id]
    );

    if ($hasil->rowCount() === 0 && !satu("SELECT 1 FROM akun WHERE id = ? AND role = 'bagian'", [$id])) {
        gagal('Akun tidak ditemukan.');
    }

    berhasil();
}


/* =========================================================
   DATA (semua yang boleh dilihat akun yang login)
   ========================================================= */

function aksi_data(): void
{
    $akun  = wajib_login();
    $admin = is_admin($akun);

    $filter = $admin ? '' : 'WHERE x.bagian_id = :bagian';
    $param  = $admin ? [] : ['bagian' => $akun['bagian_id']];

    $barang = semua(
        "SELECT x.*, bg.nama AS bagian
           FROM barang x
           JOIN bagian bg ON bg.id = x.bagian_id
           $filter
       ORDER BY x.kode",
        $param
    );

    $pinjam = semua(
        "SELECT x.*, bg.nama AS bagian
           FROM peminjaman x
           JOIN bagian bg ON bg.id = x.bagian_id
           $filter
       ORDER BY x.waktu_pinjam DESC, x.id DESC",
        $param
    );

    $akun_bagian = [];

    if ($admin) {
        $akun_bagian = array_map(
            function ($a) {
                return [
                    'id'         => (string) $a['id'],
                    'username'   => $a['username'],
                    'name'       => $a['nama'],
                    'department' => $a['bagian'],
                    'role'       => $a['role'],
                    'status'     => $a['status'],
                    'createdAt'  => waktu_js($a['created_at']),
                ];
            },
            semua(
                "SELECT a.*, bg.nama AS bagian
                   FROM akun a
                   JOIN bagian bg ON bg.id = a.bagian_id
                  WHERE a.role = 'bagian'
               ORDER BY a.created_at"
            )
        );
    }

    /* Bukti mengikuti bagian pemilik barang / peminjamannya */
    $filter_dok = $admin ? '' : 'WHERE COALESCE(b.bagian_id, p.bagian_id) = :bagian';

    $dokumentasi = semua(
        "SELECT d.*, a.nama AS pengunggah
           FROM dokumentasi d
      LEFT JOIN barang b     ON b.id = d.barang_id
      LEFT JOIN peminjaman p ON p.id = d.peminjaman_id
      LEFT JOIN akun a       ON a.id = d.diunggah_oleh
           $filter_dok
       ORDER BY d.tanggal DESC, d.id DESC",
        $param
    );

    berhasil([
        'akun'        => akun_publik($akun),
        'bagian'      => array_column(semua('SELECT nama FROM bagian ORDER BY id'), 'nama'),
        'barang'      => array_map('barang_publik', $barang),
        'peminjaman'  => array_map('pinjam_publik', $pinjam),
        'akunBagian'  => $akun_bagian,
        'dokumentasi' => array_map('dok_publik', $dokumentasi),
    ]);
}


/* =========================================================
   BARANG
   ========================================================= */

/* Nomor barang berikutnya untuk satu bagian, mis. LOG-004 */
function kode_barang_baru(int $bagian_id, int $abaikan_id = 0): string
{
    /* Baris bagian dikunci supaya nomor tidak dobel */
    $bagian = satu('SELECT kode FROM bagian WHERE id = ? FOR UPDATE', [$bagian_id]);
    $awalan = $bagian['kode'] . '-';

    $baris = satu(
        'SELECT MAX(CAST(SUBSTRING(kode, ?) AS UNSIGNED)) AS terbesar
           FROM barang
          WHERE kode LIKE ? AND id <> ?',
        [strlen($awalan) + 1, $awalan . '%', $abaikan_id]
    );

    return $awalan . str_pad((string) (((int) $baris['terbesar']) + 1), 3, '0', STR_PAD_LEFT);
}

function jumlah_dipinjam(int $barang_id, int $abaikan_pinjam_id = 0): int
{
    $baris = satu(
        "SELECT COALESCE(SUM(jumlah), 0) AS total
           FROM peminjaman
          WHERE barang_id = ? AND status = 'Dipinjam' AND id <> ?",
        [$barang_id, $abaikan_pinjam_id]
    );

    return (int) $baris['total'];
}

function aksi_barang_simpan(): void
{
    $akun = wajib_login();

    $id    = angka('id');
    $nama  = teks('name', 150);
    $baik  = angka('good');
    $kurang = angka('fair');
    $rusak = angka('bad');
    $hilang = angka('lost');
    $ket   = teks('description', 2000);

    if ($nama === '') {
        gagal('Nama barang wajib diisi.');
    }

    /* Akun bagian selalu ke bagiannya sendiri */
    if (is_admin($akun)) {
        $baris = satu('SELECT id FROM bagian WHERE nama = ?', [teks('department', 50)]);

        if (!$baris) {
            gagal('Bagian tidak valid.');
        }

        $bagian_id = (int) $baris['id'];
    } else {
        $bagian_id = (int) $akun['bagian_id'];
    }

    $id_tersimpan = transaksi(function () use ($akun, $id, $nama, $baik, $kurang, $rusak, $hilang, $ket, $bagian_id) {
        if ($id === 0) {
            query(
                'INSERT INTO barang
                   (kode, bagian_id, nama, jumlah_baik, jumlah_kurang_baik,
                    jumlah_rusak_berat, jumlah_hilang, keterangan,
                    dibuat_oleh, diubah_oleh)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    kode_barang_baru($bagian_id), $bagian_id, $nama,
                    $baik, $kurang, $rusak, $hilang, $ket,
                    $akun['id'], $akun['id'],
                ]
            );

            return (int) db()->lastInsertId();
        }

        $lama = satu('SELECT * FROM barang WHERE id = ? FOR UPDATE', [$id]);

        if (!$lama) {
            gagal('Data tidak ditemukan.');
        }

        if (!boleh_akses_bagian($akun, (int) $lama['bagian_id'])) {
            gagal('Akses ditolak.', 403);
        }

        $dipinjam = jumlah_dipinjam($id);
        $pindah   = (int) $lama['bagian_id'] !== $bagian_id;

        if ($dipinjam > 0 && $pindah) {
            gagal("Barang ini masih dipinjam $dipinjam unit. Kembalikan dulu sebelum pindah bagian.");
        }

        /* Yang dipinjam selalu diambil dari stok Baik */
        if ($baik < $dipinjam) {
            gagal("Masih ada $dipinjam unit yang dipinjam. Jumlah Baik tidak boleh kurang dari itu.");
        }

        query(
            'UPDATE barang
                SET kode = ?, bagian_id = ?, nama = ?,
                    jumlah_baik = ?, jumlah_kurang_baik = ?,
                    jumlah_rusak_berat = ?, jumlah_hilang = ?,
                    keterangan = ?, diubah_oleh = ?
              WHERE id = ?',
            [
                $pindah ? kode_barang_baru($bagian_id, $id) : $lama['kode'],
                $bagian_id, $nama, $baik, $kurang, $rusak, $hilang, $ket,
                $akun['id'], $id,
            ]
        );

        return $id;
    });

    /* id dipakai script.js untuk upload foto bukti */
    berhasil(['id' => (string) $id_tersimpan]);
}

function aksi_barang_hapus(): void
{
    $akun = wajib_login();
    $id   = angka('id');

    $file_bukti = transaksi(function () use ($akun, $id) {
        $barang = satu('SELECT bagian_id FROM barang WHERE id = ? FOR UPDATE', [$id]);

        if (!$barang) {
            gagal('Data tidak ditemukan.');
        }

        if (!boleh_akses_bagian($akun, (int) $barang['bagian_id'])) {
            gagal('Akses ditolak.', 403);
        }

        $dipinjam = jumlah_dipinjam($id);

        if ($dipinjam > 0) {
            gagal("Barang ini masih dipinjam $dipinjam unit. Kembalikan dulu sebelum dihapus.");
        }

        $file = file_bukti('barang_id', $id);

        /* Baris dokumentasi ikut terhapus (ON DELETE CASCADE) */
        query('DELETE FROM barang WHERE id = ?', [$id]);

        return $file;
    });

    hapus_file_bukti($file_bukti);

    berhasil();
}


/* =========================================================
   PEMINJAMAN
   ========================================================= */

function kode_pinjam_baru(): string
{
    $baris = satu(
        "SELECT MAX(CAST(SUBSTRING(kode, 5) AS UNSIGNED)) AS terbesar
           FROM peminjaman
          WHERE kode LIKE 'PJM-%'
          FOR UPDATE"
    );

    return 'PJM-' . str_pad((string) (((int) $baris['terbesar']) + 1), 3, '0', STR_PAD_LEFT);
}

/* Pinjaman + cek boleh diakses akun ini */
function ambil_pinjaman(array $akun, int $id): array
{
    $pinjam = satu('SELECT * FROM peminjaman WHERE id = ? FOR UPDATE', [$id]);

    if (!$pinjam) {
        gagal('Data tidak ditemukan.');
    }

    if (!boleh_akses_bagian($akun, (int) $pinjam['bagian_id'])) {
        gagal('Akses ditolak.', 403);
    }

    return $pinjam;
}

function aksi_pinjam_simpan(): void
{
    $akun = wajib_login();

    $id        = angka('id');
    $barang_id = angka('itemId');
    $jumlah    = angka('quantity');
    $peminjam  = teks('borrower', 100);
    $waktu     = waktu_db(teks('borrowDate', 20));
    $rencana_isi = teks('returnPlan', 10);
    $rencana   = tanggal_db($rencana_isi);
    $ket       = teks('note', 2000);

    if (!$barang_id || $jumlah <= 0 || $peminjam === '' || !$waktu) {
        gagal('Lengkapi data peminjaman.');
    }

    if ($rencana_isi !== '' && !$rencana) {
        gagal('Tanggal rencana kembali tidak valid.');
    }

    if ($rencana && $rencana < substr($waktu, 0, 10)) {
        gagal('Rencana kembali tidak boleh sebelum tanggal pinjam.');
    }

    $id_tersimpan = transaksi(function () use ($akun, $id, $barang_id, $jumlah, $peminjam, $waktu, $rencana, $ket) {
        $lama = $id ? ambil_pinjaman($akun, $id) : null;

        $barang = satu('SELECT * FROM barang WHERE id = ? FOR UPDATE', [$barang_id]);

        if (!$barang || !boleh_akses_bagian($akun, (int) $barang['bagian_id'])) {
            gagal('Barang tidak ditemukan.');
        }

        /* Cek stok, kecuali pinjaman yang sudah dikembalikan */
        if (!$lama || $lama['status'] !== 'Dikembalikan') {
            $tersedia = max(
                0,
                /* Hanya barang kondisi Baik yang bisa dipinjam */
                (int) $barang['jumlah_baik']
                    - jumlah_dipinjam($barang_id, $id)
            );

            if ($jumlah > $tersedia) {
                gagal("Stok tidak cukup. Yang bisa dipinjam: $tersedia unit.");
            }
        }

        $nilai = [
            $barang_id, $barang['kode'], $barang['nama'], $barang['bagian_id'],
            $jumlah, $peminjam, $waktu, $rencana, $ket,
        ];

        if ($lama) {
            query(
                'UPDATE peminjaman
                    SET barang_id = ?, kode_barang = ?, nama_barang = ?,
                        bagian_id = ?, jumlah = ?, peminjam = ?,
                        waktu_pinjam = ?, rencana_kembali = ?, keterangan = ?
                  WHERE id = ?',
                array_merge($nilai, [$id])
            );
        } else {
            query(
                'INSERT INTO peminjaman
                   (barang_id, kode_barang, nama_barang, bagian_id, jumlah,
                    peminjam, waktu_pinjam, rencana_kembali, keterangan,
                    kode, dicatat_oleh)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                array_merge($nilai, [kode_pinjam_baru(), $akun['id']])
            );

            return (int) db()->lastInsertId();
        }

        return $id;
    });

    /* id dipakai script.js untuk upload bukti peminjaman */
    berhasil(['id' => (string) $id_tersimpan]);
}

function aksi_pinjam_kembali(): void
{
    $akun = wajib_login();
    $id   = angka('id');

    transaksi(function () use ($akun, $id) {
        $pinjam = ambil_pinjaman($akun, $id);

        if ($pinjam['status'] === 'Dikembalikan') {
            return;
        }

        /* Waktu kembali tidak boleh sebelum waktu pinjam */
        query(
            "UPDATE peminjaman
                SET status = 'Dikembalikan',
                    waktu_kembali = GREATEST(NOW(), waktu_pinjam)
              WHERE id = ?",
            [$id]
        );
    });

    berhasil();
}

function aksi_pinjam_hapus(): void
{
    $akun = wajib_login();
    $id   = angka('id');

    $file_bukti = transaksi(function () use ($akun, $id) {
        ambil_pinjaman($akun, $id);

        $file = file_bukti('peminjaman_id', $id);

        query('DELETE FROM peminjaman WHERE id = ?', [$id]);

        return $file;
    });

    hapus_file_bukti($file_bukti);

    berhasil();
}
