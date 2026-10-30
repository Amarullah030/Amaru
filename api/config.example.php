<?php
/* =========================================================
   KONFIGURASI DATABASE
   ---------------------------------------------------------
   1. Salin file ini menjadi  config.php  (di folder yang sama).
   2. Isi sesuai database di hosting (cPanel → MySQL Databases).
   3. JANGAN upload config.php ke GitHub — isinya password.
   ========================================================= */

return [
    'db_host' => 'localhost',
    'db_name' => 'hisada_inventaris',
    'db_user' => 'root',
    'db_pass' => '',

    /* true hanya kalau website sudah pakai https */
    'cookie_secure' => false,
];
