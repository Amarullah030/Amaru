<?php
/* =========================================================
   FUNGSI DASAR API HISADA
   Koneksi database, session, jawaban JSON, cek akses.
   ========================================================= */

declare(strict_types=1);

date_default_timezone_set('Asia/Jakarta');


/* ---------- Jawaban JSON ---------- */

function jawab(array $data, int $kode = 200): void
{
    http_response_code($kode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function berhasil(array $data = []): void
{
    jawab(['ok' => true] + $data);
}

function gagal(string $pesan, int $kode = 400): void
{
    jawab(['ok' => false, 'pesan' => $pesan], $kode);
}


/* ---------- Konfigurasi & database ---------- */

function config(): array
{
    static $config = null;

    if ($config === null) {
        $file = __DIR__ . '/config.php';

        if (!is_file($file)) {
            gagal('File api/config.php belum dibuat. Salin dari config.example.php.', 500);
        }

        $config = require $file;
    }

    return $config;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $c = config();

        try {
            $pdo = new PDO(
                "mysql:host={$c['db_host']};dbname={$c['db_name']};charset=utf8mb4",
                $c['db_user'],
                $c['db_pass'],
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            gagal('Tidak bisa terhubung ke database. Cek api/config.php.', 500);
        }

        /* Semua waktu dalam WIB */
        $pdo->exec("SET time_zone = '+07:00'");
    }

    return $pdo;
}

/* Jalankan query dengan parameter (aman dari SQL injection) */
function query(string $sql, array $param = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($param);

    return $stmt;
}

function satu(string $sql, array $param = []): ?array
{
    $baris = query($sql, $param)->fetch();

    return $baris === false ? null : $baris;
}

function semua(string $sql, array $param = []): array
{
    return query($sql, $param)->fetchAll();
}

/* Jalankan beberapa query sekaligus; batal semua kalau ada error.
   (Kalau gagal() dipanggil di dalamnya, skrip berhenti dan
   MySQL otomatis membatalkan transaksi yang belum di-commit.) */
function transaksi(callable $kerja)
{
    db()->beginTransaction();

    try {
        $hasil = $kerja();
        db()->commit();

        return $hasil;
    } catch (Throwable $e) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $e;
    }
}


/* ---------- Session login ---------- */

function mulai_session(): void
{
    session_name('hisada_sesi');

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => (bool) (config()['cookie_secure'] ?? false),
        'httponly' => true,     // tidak bisa dibaca JavaScript
        'samesite' => 'Lax',
    ]);

    session_start();
}

/* Data akun yang sedang login, selalu dicek ulang ke database
   (akun yang dinonaktifkan Admin langsung keluar) */
function akun_login(): ?array
{
    static $akun = false;

    if ($akun !== false) {
        return $akun;
    }

    $akun = null;
    $id   = $_SESSION['akun_id'] ?? null;

    if ($id) {
        $akun = satu(
            "SELECT a.id, a.username, a.nama, a.role, a.bagian_id,
                    b.nama AS bagian
               FROM akun a
          LEFT JOIN bagian b ON b.id = a.bagian_id
              WHERE a.id = ? AND a.status = 'approved'",
            [$id]
        );

        if (!$akun) {
            unset($_SESSION['akun_id']);
        }
    }

    return $akun;
}

function wajib_login(): array
{
    $akun = akun_login();

    if (!$akun) {
        gagal('Sesi berakhir. Silakan login lagi.', 401);
    }

    return $akun;
}

function wajib_admin(): array
{
    $akun = wajib_login();

    if ($akun['role'] !== 'admin') {
        gagal('Hanya Admin yang boleh melakukan ini.', 403);
    }

    return $akun;
}

function is_admin(array $akun): bool
{
    return $akun['role'] === 'admin';
}

/* Akun bagian hanya boleh menyentuh data bagiannya sendiri */
function boleh_akses_bagian(array $akun, int $bagian_id): bool
{
    return is_admin($akun) || (int) $akun['bagian_id'] === $bagian_id;
}


/* ---------- Bentuk data untuk script.js ---------- */

/* "2026-10-30 19:45:00" → "2026-10-30T19:45" */
function waktu_js(?string $waktu): ?string
{
    if (!$waktu) {
        return null;
    }

    return substr(str_replace(' ', 'T', $waktu), 0, 16);
}

/* "2026-10-30T19:45" → "2026-10-30 19:45:00" (null kalau tidak valid) */
function waktu_db(?string $waktu): ?string
{
    $waktu = trim((string) $waktu);

    if (!preg_match('/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/', $waktu, $m)) {
        return null;
    }

    $hasil = "{$m[1]} {$m[2]}:00";

    return DateTime::createFromFormat('Y-m-d H:i:s', $hasil) ? $hasil : null;
}

function tanggal_db(?string $tanggal): ?string
{
    $tanggal = trim((string) $tanggal);

    if ($tanggal === '') {
        return null;
    }

    $d = DateTime::createFromFormat('!Y-m-d', $tanggal);

    return $d && $d->format('Y-m-d') === $tanggal ? $tanggal : null;
}


/* ---------- Input ---------- */

function input(): array
{
    static $data = null;

    if ($data === null) {
        $data = json_decode((string) file_get_contents('php://input'), true);

        if (!is_array($data)) {
            $data = [];
        }
    }

    return $data;
}

function teks(string $kunci, int $maks = 255): string
{
    $nilai = trim((string) (input()[$kunci] ?? ''));

    return mb_substr($nilai, 0, $maks);
}

function angka(string $kunci): int
{
    $nilai = input()[$kunci] ?? 0;

    return is_numeric($nilai) ? max(0, (int) floor((float) $nilai)) : 0;
}
