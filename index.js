<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Permainan Warna dalam Tabel</title>
    <style>
        table {
            border-collapse: collapse;
            margin: 20px auto;
        }
        td {
            width: 100px;
            height: 100px;
            border: 1px solid #000;
            cursor: pointer;
            text-align: center;
            vertical-align: middle;
            font-size: 24px;
            font-weight: bold;
        }
        #message {
            text-align: center;
            font-size: 18px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h1 style="text-align: center;">Permainan Warna dalam Tabel</h1>
    <p style="text-align: center;">Klik sel untuk mengubah warnanya. Ubah semua sel menjadi warna yang sama untuk menang!</p>
    <table id="colorTable">
        <!-- Tabel akan dibuat secara dinamis oleh JS -->
    </table>
    <div id="message"></div>

    <script>
        // Daftar warna yang tersedia
        const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];

        // Fungsi untuk membuat tabel 3x3
        function createTable() {
            const table = document.getElementById('colorTable');
            for (let i = 0; i < 3; i++) {
                const row = table.insertRow();
                for (let j = 0; j < 3; j++) {
                    const cell = row.insertCell();
                    cell.style.backgroundColor = getRandomColor();
                    cell.addEventListener('click', () => changeColor(cell));
                }
            }
        }

        // Fungsi untuk mendapatkan warna acak
        function getRandomColor() {
            return colors[Math.floor(Math.random() * colors.length)];
        }

        // Fungsi untuk mengubah warna sel saat diklik
        function changeColor(cell) {
            cell.style.backgroundColor = getRandomColor();
            checkWin();
        }

        // Fungsi untuk memeriksa apakah semua sel sama warnanya
        function checkWin() {
            const cells = document.querySelectorAll('td');
            const firstColor = cells[0].style.backgroundColor;
            const allSame = Array.from(cells).every(cell => cell.style.backgroundColor === firstColor);
            const message = document.getElementById('message');
            if (allSame) {
                message.textContent = 'Selamat! Anda menang! Semua sel berwarna sama.';
                message.style.color = 'green';
            } else {
                message.textContent = '';
            }
        }

        // Inisialisasi tabel saat halaman dimuat
        window.onload = createTable;
    </script>
</body>
</html>
