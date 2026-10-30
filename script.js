/* =========================================================
   HISADA INVENTARIS V5 (data di server PHP + MySQL)
   ========================================================= */

"use strict";

/* =========================
   KONFIGURASI
========================= */

const DEPTS = [
  "Logistik",
  "Bahasa",
  "Kesehatan",
  "Ta'mir Masjid",
  "Keamanan",
  "Pramuka",
  "Olahraga",
  "Dewan Harian",
  "Dapur",
  "Kesenian"
];

/* Alamat API PHP (folder api/ di hosting yang sama) */
const API_URL = "api/";

const TIME_ZONE = "Asia/Jakarta";

let currentUser = null;

/* Data dari server untuk akun yang sedang login */
let serverData = {
  barang: [],
  peminjaman: [],
  akunBagian: [],
  dokumentasi: []
};

/* Modal dokumentasi yang sedang dibuka */
let docTarget = null;

/* Batas ukuran file bukti (sama dengan server) */
const MAX_PROOF_SIZE = 2 * 1024 * 1024;

/* Sudah ada akun Admin di database? */
let adminExists = true;
let editingItemId = null;
let editingLoanId = null;


/* =========================
   UTILITAS
========================= */

function $(id) {
  return document.getElementById(id);
}

/* Jalankan animasi dari animasi.js (kalau anime.js termuat) */
function runAnimation(name, ...args) {
  window.Animasi?.[name]?.(...args);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* Waktu sekarang (WIB) untuk input datetime-local,
   contoh: "2026-10-30T19:45" */
function nowLocalInput() {
  const parts = {};

  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  })
    .formatToParts(new Date())
    .forEach(part => {
      parts[part.type] = part.value;
    });

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/* Tanggal + jam, contoh: "30/10/2026 19.45" */
function formatDateTime(value) {
  if (!value) return "-";

  const text =
    String(value);

  /* Tanggal saja (data lama) */
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return formatDate(text);
  }

  /* Dari input datetime-local, sudah dalam WIB */
  const local =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
    );

  if (local) {
    return `${local[3]}/${local[2]}/${local[1]} ${local[4]}.${local[5]}`;
  }

  const d = new Date(text);

  if (Number.isNaN(d.getTime())) {
    return text;
  }

  return d
    .toLocaleString("id-ID", {
      timeZone: TIME_ZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
    .replace(",", "");
}

/* Jam berjalan di topbar */
function renderClock() {
  const d = new Date();

  const date =
    d.toLocaleDateString("id-ID", {
      timeZone: TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  const time =
    d.toLocaleTimeString("id-ID", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

  setText(
    "currentClock",
    `${date} · ${time} WIB`
  );
}

function startClock() {
  renderClock();

  setInterval(
    renderClock,
    1000
  );
}

function formatDate(date) {
  if (!date) return "-";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return date;
  }

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function isSectionUser() {
  return currentUser?.role === "bagian";
}

function getUserDept() {
  return currentUser?.department || "";
}


/* =========================
   API SERVER
========================= */

/* Panggil API PHP. Kalau gagal, lempar Error berisi pesan server. */
async function api(aksi, data = null) {
  const options = {
    method: data ? "POST" : "GET",
    credentials: "same-origin",
    headers: {
      "Accept": "application/json"
    }
  };

  if (data) {
    /* Penanda bahwa permintaan berasal dari aplikasi ini */
    options.headers["X-HISADA"] = "1";

    if (data instanceof FormData) {
      /* Upload file: browser yang mengatur Content-Type */
      options.body = data;
    } else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(data);
    }
  }

  let response;

  try {
    response = await fetch(
      `${API_URL}?aksi=${encodeURIComponent(aksi)}`,
      options
    );
  } catch (error) {
    throw new Error(
      "Tidak bisa terhubung ke server. Cek koneksi internet."
    );
  }

  let result = null;

  try {
    result = await response.json();
  } catch (error) {
    result = null;
  }

  /* Sesi habis / akun dinonaktifkan → kembali ke login */
  if (response.status === 401 && currentUser) {
    currentUser = null;
    showLoginPage();
  }

  if (!result || !result.ok) {
    throw new Error(
      result?.pesan || "Terjadi kesalahan di server."
    );
  }

  return result;
}

/* Ambil ulang semua data yang boleh dilihat akun ini */
async function refreshData() {
  const result =
    await api("data");

  currentUser =
    result.akun;

  serverData = {
    barang: result.barang || [],
    peminjaman: result.peminjaman || [],
    akunBagian: result.akunBagian || [],
    dokumentasi: result.dokumentasi || []
  };
}

/* Simpan perubahan lewat API, lalu muat ulang dan gambar ulang
   semua tampilan. Mengembalikan true kalau berhasil. */
async function saveToServer(aksi, data) {
  try {
    await api(aksi, data);
    await refreshData();
  } catch (error) {
    alert(error.message);
    return false;
  }

  renderAll();
  return true;
}

function renderAll() {
  renderDashboard();
  renderInventory();
  renderLoans();
  renderAccounts();
}

function users() {
  return serverData.akunBagian;
}

function items() {
  return serverData.barang;
}

function loans() {
  return serverData.peminjaman;
}

async function logout() {
  try {
    await api("logout", {});
  } catch (error) {
    /* Tetap keluar di tampilan walau server tidak menjawab */
  }

  currentUser = null;

  serverData = {
    barang: [],
    peminjaman: [],
    akunBagian: [],
    dokumentasi: []
  };

  setValue("inventorySearch", "");
  setValue("inventoryDepartmentFilter", "");

  showLoginPage();
}


/* =========================
   AKSES DATA
========================= */

function visibleItems() {
  const data = items();

  if (isAdmin()) {
    return data;
  }

  return data.filter(
    item =>
      item.department === getUserDept()
  );
}

function visibleLoans() {
  const data = loans();

  if (isAdmin()) {
    return data;
  }

  return data.filter(
    loan =>
      loan.department === getUserDept()
  );
}


/* =========================
   TOTAL INVENTARIS
========================= */

/* Total = jumlah keseluruhan (Baik + Kurang Baik + Rusak Berat + Hilang) */
function itemTotal(item) {
  return (
    normalizeNumber(item.good) +
    normalizeNumber(item.fair) +
    normalizeNumber(item.bad) +
    normalizeNumber(item.lost)
  );
}

/* Jumlah unit yang sedang dipinjam (belum kembali) */
function borrowedCount(itemId, ignoreLoanId = null) {
  return loans()
    .filter(
      loan =>
        loan.itemId === itemId &&
        loan.id !== ignoreLoanId &&
        loan.status !== "Dikembalikan"
    )
    .reduce(
      (sum, loan) =>
        sum + normalizeNumber(loan.quantity),
      0
    );
}

/* Yang bisa dipinjam: hanya kondisi Baik,
   dikurangi yang sedang dipinjam */
function availableCount(item, ignoreLoanId = null) {
  return Math.max(
    0,
    normalizeNumber(item.good) -
      borrowedCount(item.id, ignoreLoanId)
  );
}


/* =========================
   HALAMAN
========================= */

function allPages() {
  return document.querySelectorAll(
    ".page, .app-page"
  );
}

function hideAllPages() {
  allPages().forEach(page => {
    page.classList.add("hidden");
  });
}

function showLoginPage() {
  hideAllPages();

  /* Belum ada Admin di database */
  const page =
    adminExists
      ? $("loginPage")
      : $("setupPage");

  if (page) {
    page.classList.remove("hidden");
  }

  const app =
    $("appPage");

  if (app) {
    app.classList.add("hidden");
  }

  runAnimation("authCard", page);
}

function showAppPage() {
  hideAllPages();

  const app =
    $("appPage");

  if (app) {
    app.classList.remove("hidden");
  }

  renderUserInfo();

  showSection("dashboard");
}

function showSection(section) {
  document
    .querySelectorAll("[data-section]")
    .forEach(page => {
      page.classList.add("hidden");
    });

  const target =
    document.querySelector(
      `[data-section="${section}"]`
    );

  if (target) {
    target.classList.remove("hidden");

    runAnimation("section", target);
  }

  document
    .querySelectorAll(
      ".nav-link, .menu-link"
    )
    .forEach(link => {
      link.classList.remove("active");

      if (
        link.dataset.target === section
      ) {
        link.classList.add("active");
      }
    });

  if (section === "dashboard") {
    renderDashboard();
  }

  if (section === "inventory") {
    renderInventory();
  }

  if (section === "loans") {
    renderLoans();
  }

  if (section === "accounts") {
    renderAccounts();
  }
}


/* =========================
   BUAT ADMIN PERTAMA
========================= */

async function setupAdmin(data) {
  try {
    const result =
      await api("setup_admin", data);

    adminExists = true;

    return {
      success: true,
      message: result.pesan
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}


/* =========================
   LOGIN
========================= */

async function login(username, password) {
  try {
    await api("login", {
      username,
      password
    });

    await refreshData();
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }

  showAppPage();
  renderAll();

  return {
    success: true
  };
}


/* =========================
   SIGN UP
========================= */

async function signup(data) {
  try {
    const result =
      await api("daftar", data);

    return {
      success: true,
      message: result.pesan
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}


/* =========================
   DASHBOARD
========================= */

function renderDashboard() {
  const data =
    visibleItems();

  const totalGood =
    data.reduce(
      (sum, item) =>
        sum + normalizeNumber(item.good),
      0
    );

  const totalFair =
    data.reduce(
      (sum, item) =>
        sum + normalizeNumber(item.fair),
      0
    );

  const totalBad =
    data.reduce(
      (sum, item) =>
        sum + normalizeNumber(item.bad),
      0
    );

  const totalLost =
    data.reduce(
      (sum, item) =>
        sum + normalizeNumber(item.lost),
      0
    );

  /* Total = jumlah keseluruhan */
  const total =
    totalGood +
    totalFair +
    totalBad +
    totalLost;

  setText(
    "statGood",
    totalGood
  );

  setText(
    "statFair",
    totalFair
  );

  setText(
    "statBad",
    totalBad
  );

  setText(
    "statLost",
    totalLost
  );

  setText(
    "statTotal",
    total
  );

  /* Angka statistik berhitung naik/turun */
  runAnimation("countUp", "statGood", totalGood);
  runAnimation("countUp", "statFair", totalFair);
  runAnimation("countUp", "statBad", totalBad);
  runAnimation("countUp", "statLost", totalLost);
  runAnimation("countUp", "statTotal", total);

  setText(
    "dashboardTitle",
    isAdmin()
      ? "Dashboard HISADA"
      : `Dashboard ${getUserDept()}`
  );

  renderDepartmentSummary();
  renderInventoryCharts();
}

function renderDepartmentSummary() {
  const container =
    $("departmentSummary");

  if (!container) {
    return;
  }

  if (!isAdmin()) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML =
    DEPTS.map(dept => {
      const data =
        items().filter(
          item =>
            item.department === dept
        );

      const total =
        data.reduce(
          (sum, item) =>
            sum + itemTotal(item),
          0
        );

      return `
        <div class="summary-card">
          <strong>${escapeHTML(dept)}</strong>
          <span>${total} barang</span>
        </div>
      `;
    }).join("");
}


/* =========================
   INVENTARIS
========================= */

/* =========================
   PENCARIAN BARANG
========================= */

/* Kata kunci dari kotak cari, mis. "tenda log" → ["tenda", "log"] */
function searchTerms() {
  return String(getValue("inventorySearch"))
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/* Semua kata kunci harus ada di kode / nama / bagian / keterangan */
function matchesSearch(item, terms) {
  const text = [
    item.code,
    item.name,
    item.department,
    item.description
  ]
    .join(" ")
    .toLowerCase();

  return terms.every(
    term => text.includes(term)
  );
}

/* Tandai bagian teks yang cocok dengan <mark>, tetap aman dari HTML */
function highlight(value, terms) {
  const text =
    String(value ?? "");

  const lower =
    text.toLowerCase();

  if (
    terms.length === 0 ||
    lower.length !== text.length
  ) {
    return escapeHTML(text);
  }

  /* Cari semua posisi yang cocok, lalu gabungkan yang bertumpuk */
  const ranges = [];

  terms.forEach(term => {
    let index =
      lower.indexOf(term);

    while (index !== -1) {
      ranges.push([index, index + term.length]);
      index = lower.indexOf(term, index + term.length);
    }
  });

  if (ranges.length === 0) {
    return escapeHTML(text);
  }

  ranges.sort((a, b) => a[0] - b[0]);

  const merged = [ranges[0]];

  ranges.slice(1).forEach(([start, end]) => {
    const last =
      merged[merged.length - 1];

    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  });

  let html = "";
  let position = 0;

  merged.forEach(([start, end]) => {
    html +=
      escapeHTML(text.slice(position, start)) +
      `<mark>${escapeHTML(text.slice(start, end))}</mark>`;

    position = end;
  });

  return html + escapeHTML(text.slice(position));
}

function renderInventory() {
  const tbody =
    $("inventoryTableBody");

  if (!tbody) {
    return;
  }

  let data =
    visibleItems();

  /* Filter bagian hanya berlaku untuk Admin */
  const filter =
    $("inventoryDepartmentFilter");

  if (
    isAdmin() &&
    filter &&
    filter.value
  ) {
    data =
      data.filter(
        item =>
          item.department ===
          filter.value
      );
  }

  /* Pencarian */
  const query =
    String(getValue("inventorySearch")).trim();

  const terms =
    searchTerms();

  const totalBeforeSearch =
    data.length;

  if (terms.length > 0) {
    data =
      data.filter(
        item =>
          matchesSearch(item, terms)
      );
  }

  const info =
    $("inventorySearchInfo");

  if (info) {
    info.classList.toggle(
      "hidden",
      terms.length === 0
    );

    info.textContent =
      terms.length > 0
        ? `Ditemukan ${data.length} dari ${totalBeforeSearch} barang untuk “${query}”`
        : "";
  }

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11">
          ${
            terms.length > 0
              ? `Tidak ada barang yang cocok dengan “${escapeHTML(query)}”.`
              : "Belum ada data inventaris."
          }
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    data.map(item => {
      const total =
        itemTotal(item);

      const actionButtons =
        `
          <button
            class="btn btn-small"
            onclick="openItemModal('${item.id}')"
          >
            Edit
          </button>

          ${proofButton("barang", item.id)}

          <button
            class="btn btn-small btn-danger"
            onclick="deleteItem('${item.id}')"
          >
            Hapus
          </button>
        `;

      return `
        <tr>
          <td>${highlight(item.code, terms)}</td>

          <td>
            ${highlight(item.name, terms)}
          </td>

          <td>
            ${total}
          </td>

          <td>
            ${normalizeNumber(item.good)}
          </td>

          <td>
            ${normalizeNumber(item.fair)}
          </td>

          <td>
            ${normalizeNumber(item.bad)}
          </td>

          <td>
            ${normalizeNumber(item.lost)}
          </td>

          <td>
            ${highlight(item.department, terms)}
          </td>

          <td>
            ${highlight(item.description || "-", terms)}
          </td>

          <td>
            ${formatDateTime(item.updatedAt)}
          </td>

          <td>
            ${
              isAdmin() || isSectionUser()
                ? actionButtons
                : "-"
            }
          </td>
        </tr>
      `;
    }).join("");

  runAnimation("rows", tbody);
}


/* =========================
   MODAL INVENTARIS
========================= */

function openItemModal(id = null) {
  if (
    !isAdmin() &&
    !isSectionUser()
  ) {
    return;
  }

  editingItemId = id;

  const modal =
    $("itemModal");

  if (!modal) {
    return;
  }

  const form =
    $("itemForm");

  if (form) {
    form.reset();
  }

  const item =
    id
      ? items().find(
          data => data.id === id
        )
      : null;

  resetProofDate("itemProofDate");

  if (item) {
    setValue(
      "itemName",
      item.name
    );

    setValue(
      "itemGood",
      item.good
    );

    setValue(
      "itemFair",
      item.fair
    );

    setValue(
      "itemBad",
      item.bad
    );

    setValue(
      "itemLost",
      item.lost
    );

    setValue(
      "itemDescription",
      item.description
    );

    if (isAdmin()) {
      setValue(
        "itemDepartment",
        item.department
      );
    }
  } else {
    setValue(
      "itemGood",
      0
    );

    setValue(
      "itemFair",
      0
    );

    setValue(
      "itemBad",
      0
    );

    setValue(
      "itemLost",
      0
    );

    if (isAdmin()) {
      setValue(
        "itemDepartment",
        ""
      );
    } else {
      setValue(
        "itemDepartment",
        getUserDept()
      );
    }
  }

  modal.classList.remove("hidden");

  runAnimation("modal", modal);
}

function closeItemModal() {
  editingItemId = null;

  const modal =
    $("itemModal");

  if (modal) {
    modal.classList.add("hidden");
  }
}

async function saveItemFromForm() {
  if (
    !isAdmin() &&
    !isSectionUser()
  ) {
    return;
  }

  const name =
    String(
      getValue("itemName")
    ).trim();

  if (!name) {
    alert("Nama barang wajib diisi.");
    return;
  }

  const proofFile =
    $("itemProofFile")?.files?.[0] || null;

  /* Bagian untuk akun bagian ditentukan server */
  const saved =
    await saveWithProof(
      "barang_simpan",
      {
        id: editingItemId || 0,
        name,
        department: getValue("itemDepartment"),
        good: getValue("itemGood"),
        fair: getValue("itemFair"),
        bad: getValue("itemBad"),
        lost: getValue("itemLost"),
        description: getValue("itemDescription")
      },
      "barang",
      proofFile && {
        kind: "upload",
        file: proofFile,
        date: getValue("itemProofDate"),
        note: getValue("itemProofNote")
      }
    );

  if (saved) {
    closeItemModal();
  }
}


/* =========================
   HAPUS INVENTARIS
========================= */

async function deleteItem(id) {
  const item =
    items().find(
      value =>
        value.id === id
    );

  if (!item) {
    return;
  }

  if (
    !confirm(
      `Hapus barang "${item.name}"?`
    )
  ) {
    return;
  }

  await saveToServer("barang_hapus", {
    id
  });
}


/* =========================
   PEMINJAMAN
========================= */

function renderLoans() {
  const tbody =
    $("loanTableBody");

  if (!tbody) {
    return;
  }

  const data =
    visibleLoans();

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          Belum ada data peminjaman.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    data.map(loan => {
      const returned =
        loan.status === "Dikembalikan";

      return `
        <tr>
          <td>
            ${escapeHTML(loan.code)}
          </td>

          <td>
            ${
              loan.itemCode
                ? `${escapeHTML(loan.itemCode)} · `
                : ""
            }${escapeHTML(loan.itemName)}
          </td>

          <td>
            ${normalizeNumber(loan.quantity)}
          </td>

          <td>
            ${escapeHTML(loan.borrower)}
          </td>

          <td>
            ${formatDateTime(loan.borrowDate)}
          </td>

          <td>
            ${formatDate(loan.returnPlan)}
          </td>

          <td>
            ${escapeHTML(loan.department)}
          </td>

          <td>
            ${escapeHTML(loan.status)}
            ${
              returned && loan.returnedAt
                ? `<br><small>${formatDateTime(loan.returnedAt)}</small>`
                : ""
            }
          </td>

          <td>
            ${escapeHTML(loan.note || "-")}
          </td>

          <td>
            <button
              class="btn btn-small"
              onclick="openLoanModal('${loan.id}')"
            >
              Edit
            </button>

            ${
              !returned
                ? `
                  <button
                    class="btn btn-small"
                    onclick="returnLoan('${loan.id}')"
                  >
                    Tandai Dikembalikan
                  </button>
                `
                : ""
            }

            ${proofButton("peminjaman", loan.id)}

            <button
              class="btn btn-small btn-danger"
              onclick="deleteLoan('${loan.id}')"
            >
              Hapus
            </button>
          </td>
        </tr>
      `;
    }).join("");

  runAnimation("rows", tbody);
}


/* =========================
   MODAL PEMINJAMAN
========================= */

/* Isi pilihan barang: hanya barang yang boleh dilihat,
   lengkap dengan sisa yang bisa dipinjam */
function populateLoanItems(selectedId = "", ignoreLoanId = null) {
  const select =
    $("loanItemId");

  if (!select) {
    return;
  }

  const options =
    visibleItems()
      .slice()
      .sort((a, b) =>
        String(a.code).localeCompare(String(b.code))
      )
      .map(item => {
        const available =
          availableCount(item, ignoreLoanId);

        const label =
          `${item.code} · ${item.name}` +
          (isAdmin() ? ` (${item.department})` : "") +
          ` · tersedia ${available}`;

        const disabled =
          available <= 0 &&
          item.id !== selectedId;

        return `
          <option
            value="${escapeHTML(item.id)}"
            ${disabled ? "disabled" : ""}
          >
            ${escapeHTML(label)}
          </option>
        `;
      })
      .join("");

  select.innerHTML = `
    <option value="">
      Pilih Barang
    </option>
    ${options}
  `;

  select.value =
    selectedId || "";
}

function openLoanModal(id = null) {
  if (
    !isAdmin() &&
    !isSectionUser()
  ) {
    return;
  }

  editingLoanId = id;

  const modal =
    $("loanModal");

  if (!modal) {
    return;
  }

  const form =
    $("loanForm");

  if (form) {
    form.reset();
  }

  const loan =
    id
      ? loans().find(
          value =>
            value.id === id
        )
      : null;

  populateLoanItems(
    loan?.itemId || "",
    loan?.id || null
  );

  resetProofDate("loanProofDate");
  toggleProofKind("data-proof-kind", "upload");

  if (loan) {
    setValue(
      "loanQuantity",
      loan.quantity
    );

    setValue(
      "loanBorrower",
      loan.borrower
    );

    /* Data lama hanya punya tanggal, tanpa jam */
    setValue(
      "loanBorrowDate",
      /^d{4}-d{2}-d{2}$/.test(loan.borrowDate || "")
        ? `${loan.borrowDate}T00:00`
        : loan.borrowDate
    );

    setValue(
      "loanReturnPlan",
      loan.returnPlan
    );

    setValue(
      "loanNote",
      loan.note
    );

    if (!loan.itemId) {
      alert(
        `Data lama: barang "${loan.itemName}" belum terhubung ke inventaris. Pilih barangnya dari daftar.`
      );
    }
  } else {
    setValue(
      "loanBorrowDate",
      nowLocalInput()
    );
  }

  modal.classList.remove("hidden");

  runAnimation("modal", modal);
}

function closeLoanModal() {
  editingLoanId = null;

  const modal =
    $("loanModal");

  if (modal) {
    modal.classList.add("hidden");
  }
}

async function saveLoanFromForm() {
  const itemId =
    getValue("loanItemId");

  const quantity =
    normalizeNumber(
      getValue("loanQuantity")
    );

  const borrower =
    String(
      getValue("loanBorrower")
    ).trim();

  const borrowDate =
    getValue("loanBorrowDate");

  const returnPlan =
    getValue("loanReturnPlan");

  if (
    !itemId ||
    quantity <= 0 ||
    !borrower ||
    !borrowDate
  ) {
    alert(
      "Lengkapi data peminjaman."
    );
    return;
  }

  if (
    returnPlan &&
    returnPlan < borrowDate.slice(0, 10)
  ) {
    alert(
      "Rencana kembali tidak boleh sebelum tanggal pinjam."
    );
    return;
  }

  const proofKind =
    getValue("loanProofKind") || "upload";

  const proofFile =
    $("loanProofFile")?.files?.[0] || null;

  const proofLink =
    String(getValue("loanProofLink")).trim();

  const proof =
    proofKind === "link"
      ? proofLink && { kind: "link", url: proofLink }
      : proofFile && { kind: "upload", file: proofFile };

  /* Stok & bagian dicek ulang oleh server */
  const saved =
    await saveWithProof(
      "pinjam_simpan",
      {
        id: editingLoanId || 0,
        itemId,
        quantity,
        borrower,
        borrowDate,
        returnPlan,
        note: getValue("loanNote")
      },
      "peminjaman",
      proof && {
        ...proof,
        date: getValue("loanProofDate"),
        note: getValue("loanProofNote")
      }
    );

  if (saved) {
    closeLoanModal();
  }
}


/* =========================
   DOKUMENTASI / BUKTI
========================= */

function todayLocal() {
  return nowLocalInput().slice(0, 10);
}

/* Tanggal dokumentasi default hari ini, tidak boleh lewat hari ini */
function resetProofDate(id) {
  const input =
    $(id);

  if (!input) {
    return;
  }

  input.value =
    todayLocal();

  input.max =
    todayLocal();
}

/* Tampilkan isian sesuai jenis bukti (upload / link) */
function toggleProofKind(attribute, kind) {
  document
    .querySelectorAll(`[${attribute}]`)
    .forEach(element => {
      element.classList.toggle(
        "hidden",
        element.getAttribute(attribute) !== kind
      );
    });
}

function docsFor(parentType, parentId) {
  return serverData.dokumentasi.filter(
    doc =>
      doc.parentType === parentType &&
      doc.parentId === parentId
  );
}

function proofButton(parentType, parentId) {
  const count =
    docsFor(parentType, parentId).length;

  return `
    <button
      class="btn btn-small btn-proof"
      onclick="openDocModal('${parentType}', '${parentId}')"
      title="Dokumentasi / bukti"
    >
      📎 Bukti${count ? ` (${count})` : ""}
    </button>
  `;
}

/* Kecilkan foto di browser sebelum upload (maks. 1600 px, JPEG).
   Kalau gagal / tidak didukung, file asli yang dipakai. */
async function compressImage(file) {
  if (
    !file ||
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  try {
    const bitmap =
      await createImageBitmap(file);

    const scale =
      Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));

    const canvas =
      document.createElement("canvas");

    canvas.width =
      Math.round(bitmap.width * scale);

    canvas.height =
      Math.round(bitmap.height * scale);

    const context =
      canvas.getContext("2d");

    /* Latar putih untuk PNG transparan */
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob =
      await new Promise(resolve =>
        canvas.toBlob(resolve, "image/jpeg", 0.82)
      );

    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File(
      [blob],
      file.name.replace(/\.\w+$/, "") + ".jpg",
      { type: "image/jpeg" }
    );
  } catch (error) {
    return file;
  }
}

/* Kirim satu bukti ke server */
async function uploadProof(parentType, parentId, proof) {
  const form =
    new FormData();

  form.append("parentType", parentType);
  form.append("parentId", parentId);
  form.append("kind", proof.kind);
  form.append("date", proof.date || todayLocal());
  form.append("note", proof.note || "");

  if (proof.kind === "link") {
    form.append("url", proof.url);
  } else {
    const file =
      await compressImage(proof.file);

    if (file.size > MAX_PROOF_SIZE) {
      throw new Error(
        "File terlalu besar. Maksimal 2 MB."
      );
    }

    form.append("file", file, file.name);
  }

  await api("dok_tambah", form);
}

/* Simpan data (barang / peminjaman), lalu bukti kalau ada */
async function saveWithProof(aksi, data, parentType, proof) {
  let result;

  try {
    result =
      await api(aksi, data);
  } catch (error) {
    alert(error.message);
    return false;
  }

  if (proof) {
    try {
      await uploadProof(parentType, result.id, proof);
    } catch (error) {
      alert(
        `Data tersimpan, tapi bukti gagal disimpan: ${error.message}\nCoba lagi lewat tombol 📎 Bukti.`
      );
    }
  }

  try {
    await refreshData();
  } catch (error) {
    alert(error.message);
  }

  renderAll();
  return true;
}

function formatSize(bytes) {
  if (!bytes) return "";

  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderDocList() {
  const list =
    $("docList");

  if (!list || !docTarget) {
    return;
  }

  const docs =
    docsFor(docTarget.type, docTarget.id);

  if (docs.length === 0) {
    list.innerHTML = `
      <p class="doc-empty">
        Belum ada bukti. Tambahkan di bawah.
      </p>
    `;

    return;
  }

  list.innerHTML =
    docs.map(doc => {
      const url =
        escapeHTML(doc.url);

      let preview;

      if (doc.type === "gambar") {
        preview = `
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="doc-thumb">
            <img src="${url}" alt="${escapeHTML(doc.note || doc.fileName)}" loading="lazy">
          </a>
        `;
      } else if (doc.type === "file") {
        preview = `
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="doc-thumb doc-icon">
            📄<span>PDF</span>
          </a>
        `;
      } else {
        preview = `
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="doc-thumb doc-icon">
            🔗<span>Link</span>
          </a>
        `;
      }

      let source;

      if (doc.type === "link") {
        let host = doc.url;

        try {
          host = new URL(doc.url).hostname;
        } catch (error) {
          /* tampilkan apa adanya */
        }

        source = `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHTML(host)}</a>`;
      } else {
        source = `${escapeHTML(doc.fileName)} ${doc.size ? `· ${formatSize(doc.size)}` : ""}`;
      }

      return `
        <div class="doc-item">
          ${preview}

          <div class="doc-info">
            <strong>📅 ${formatDate(doc.date)}</strong>
            <span>${escapeHTML(doc.note || "-")}</span>
            <small>${source}</small>
            <small>Diunggah ${escapeHTML(doc.uploadedBy)} · ${formatDateTime(doc.createdAt)}</small>
          </div>

          <button
            type="button"
            class="btn btn-small btn-danger"
            onclick="deleteDoc('${doc.id}')"
          >
            Hapus
          </button>
        </div>
      `;
    }).join("");

  runAnimation("rows", list);
}

function openDocModal(parentType, parentId) {
  const parent =
    parentType === "barang"
      ? items().find(item => item.id === parentId)
      : loans().find(loan => loan.id === parentId);

  if (!parent) {
    return;
  }

  docTarget = {
    type: parentType,
    id: parentId
  };

  setText(
    "docTitle",
    parentType === "barang"
      ? `📷 Dokumentasi ${parent.code} · ${parent.name}`
      : `📎 Bukti ${parent.code} · ${parent.itemName}`
  );

  setText(
    "docSubtitle",
    parentType === "barang"
      ? "Foto bukti barang, urut dari tanggal terbaru"
      : `Peminjam: ${parent.borrower} · ${formatDateTime(parent.borrowDate)}`
  );

  const form =
    $("docForm");

  if (form) {
    form.reset();
  }

  /* Bukti barang hanya foto; peminjaman boleh foto/PDF/link */
  const isItem =
    parentType === "barang";

  $("docKindGroup")?.classList.toggle("hidden", isItem);

  const fileInput =
    $("docFile");

  if (fileInput) {
    fileInput.accept =
      isItem
        ? "image/jpeg,image/png,image/webp"
        : "image/jpeg,image/png,image/webp,application/pdf";
  }

  setText(
    "docFileHint",
    isItem
      ? "JPG, PNG, atau WebP. Foto otomatis dikecilkan."
      : "Foto (JPG, PNG, WebP) atau PDF, maksimal 2 MB."
  );

  toggleProofKind("data-doc-kind", "upload");
  resetProofDate("docDate");
  renderDocList();

  const modal =
    $("docModal");

  if (modal) {
    modal.classList.remove("hidden");
    runAnimation("modal", modal);
  }
}

function closeDocModal() {
  docTarget = null;

  $("docModal")?.classList.add("hidden");
}

async function saveDocFromForm() {
  if (!docTarget) {
    return;
  }

  const kind =
    docTarget.type === "barang"
      ? "upload"
      : getValue("docKind");

  const file =
    $("docFile")?.files?.[0] || null;

  const url =
    String(getValue("docLink")).trim();

  if (kind === "upload" && !file) {
    alert("Pilih file bukti dulu.");
    return;
  }

  if (kind === "link" && !url) {
    alert("Tempel link bukti dulu.");
    return;
  }

  try {
    await uploadProof(docTarget.type, docTarget.id, {
      kind,
      file,
      url,
      date: getValue("docDate"),
      note: getValue("docNote")
    });

    await refreshData();
  } catch (error) {
    alert(error.message);
    return;
  }

  $("docForm")?.reset();
  resetProofDate("docDate");
  toggleProofKind("data-doc-kind", "upload");

  renderAll();
  renderDocList();
}

async function deleteDoc(id) {
  if (!confirm("Hapus bukti ini?")) {
    return;
  }

  try {
    await api("dok_hapus", { id });
    await refreshData();
  } catch (error) {
    alert(error.message);
    return;
  }

  renderAll();
  renderDocList();
}

function setupDocForms() {
  $("docForm")?.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      saveDocFromForm();
    }
  );

  $("docKind")?.addEventListener(
    "change",
    event =>
      toggleProofKind("data-doc-kind", event.target.value)
  );

  $("loanProofKind")?.addEventListener(
    "change",
    event =>
      toggleProofKind("data-proof-kind", event.target.value)
  );
}


/* =========================
   KEMBALIKAN BARANG
========================= */

async function returnLoan(id) {
  if (
    !confirm(
      "Tandai peminjaman ini sebagai dikembalikan?"
    )
  ) {
    return;
  }

  await saveToServer("pinjam_kembali", {
    id
  });
}

async function deleteLoan(id) {
  if (
    !confirm(
      "Hapus data peminjaman ini?"
    )
  ) {
    return;
  }

  await saveToServer("pinjam_hapus", {
    id
  });
}


/* =========================
   AKUN
========================= */

function renderAccounts() {
  const tbody =
    $("accountsTableBody");

  if (!tbody) {
    return;
  }

  if (!isAdmin()) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          Hanya Admin yang dapat mengelola akun.
        </td>
      </tr>
    `;

    return;
  }

  const data =
    users();

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          Belum ada akun bagian.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    data.map(user => {
      let action = "";

      if (
        user.status === "pending"
      ) {
        action = `
          <button
            class="btn btn-small"
            onclick="approveUser('${user.id}')"
          >
            Setujui
          </button>

          <button
            class="btn btn-small btn-danger"
            onclick="rejectUser('${user.id}')"
          >
            Tolak
          </button>
        `;
      } else if (
        user.status === "approved"
      ) {
        action = `
          <button
            class="btn btn-small btn-danger"
            onclick="rejectUser('${user.id}')"
          >
            Nonaktifkan
          </button>
        `;
      } else {
        action = `
          <button
            class="btn btn-small"
            onclick="approveUser('${user.id}')"
          >
            Aktifkan
          </button>
        `;
      }

      return `
        <tr>
          <td>
            ${escapeHTML(user.name)}
          </td>

          <td>
            ${escapeHTML(user.username)}
          </td>

          <td>
            ${escapeHTML(user.department)}
          </td>

          <td>
            ${escapeHTML(user.role)}
          </td>

          <td>
            ${escapeHTML(user.status)}
          </td>

          <td>
            ${formatDate(user.createdAt)}
          </td>

          <td>
            ${action}
          </td>
        </tr>
      `;
    }).join("");

  runAnimation("rows", tbody);
}

async function approveUser(id) {
  if (!isAdmin()) {
    return;
  }

  await saveToServer("akun_status", {
    id,
    status: "approved"
  });
}

async function rejectUser(id) {
  if (!isAdmin()) {
    return;
  }

  if (
    !confirm(
      "Nonaktifkan akun ini?"
    )
  ) {
    return;
  }

  await saveToServer("akun_status", {
    id,
    status: "rejected"
  });
}


/* =========================
   SELECT DEPARTEMEN
========================= */

function populateSelects() {
  const selects =
    document.querySelectorAll(
      "select[data-departments]"
    );

  selects.forEach(select => {
    const current =
      select.value;

    select.innerHTML = `
      <option value="">
        Pilih Bagian
      </option>
      ${DEPTS.map(
        dept =>
          `<option value="${escapeHTML(dept)}">
            ${escapeHTML(dept)}
          </option>`
      ).join("")}
    `;

    if (current) {
      select.value = current;
    }
  });

  const filters =
    document.querySelectorAll(
      "select[data-department-filter]"
    );

  filters.forEach(select => {
    select.innerHTML = `
      <option value="">
        Semua Bagian
      </option>

      ${DEPTS.map(
        dept =>
          `<option value="${escapeHTML(dept)}">
            ${escapeHTML(dept)}
          </option>`
      ).join("")}
    `;
  });
}


/* =========================
   HEADER / USER INFO
========================= */

function renderUserInfo() {
  const userName =
    currentUser?.name ||
    currentUser?.username ||
    "User";

  const userRole =
    isAdmin()
      ? "Administrator"
      : getUserDept();

  const userDepartment =
    isAdmin()
      ? "Semua Bagian"
      : getUserDept();

  setText(
    "currentUserName",
    userName
  );

  setText(
    "currentUserRole",
    userRole
  );

  setText(
    "topbarName",
    userName
  );

  setText(
    "currentUserDepartment",
    userDepartment
  );

  /* Avatar otomatis mengambil huruf pertama nama */
  const avatar =
    document.querySelector(".user-avatar");

  if (avatar) {
    avatar.textContent =
      userName
        .trim()
        .charAt(0)
        .toUpperCase();
  }

  /* Menu khusus Admin */
  document
    .querySelectorAll(
      "[data-admin-only]"
    )
    .forEach(element => {
      element.classList.toggle(
        "hidden",
        !isAdmin()
      );
    });
}

/* =========================
   FORM LOGIN
========================= */

function setupLoginForm() {
  const form =
    $("loginForm");

  if (!form) {
    return;
  }

  form.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      try {
        const result =
          await login(
            getValue("loginUsername"),
            getValue("loginPassword")
          );

        if (!result.success) {
          runAnimation("shake", form.closest(".auth-card"));
          alert(result.message);
        }
      } catch (error) {
        runAnimation("shake", form.closest(".auth-card"));
        alert(error.message);
      }
    }
  );
}


/* =========================
   FORM BUAT ADMIN
========================= */

function setupAdminForm() {
  const form =
    $("setupForm");

  if (!form) {
    return;
  }

  form.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      try {
        const result =
          await setupAdmin({
            username:
              getValue("setupUsername"),

            password:
              getValue("setupPassword"),

            confirm:
              getValue("setupPasswordConfirm")
          });

        if (!result.success) {
          runAnimation("shake", form.closest(".auth-card"));
        }

        alert(result.message);

        if (result.success) {
          form.reset();

          showLoginPage();
        }
      } catch (error) {
        runAnimation("shake", form.closest(".auth-card"));
        alert(error.message);
      }
    }
  );
}


/* =========================
   FORM SIGN UP
========================= */

function setupSignupForm() {
  const form =
    $("signupForm");

  if (!form) {
    return;
  }

  form.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      let result;

      try {
        result =
          await signup({
            name:
              getValue("signupName"),

            username:
              getValue("signupUsername"),

            password:
              getValue("signupPassword"),

            department:
              getValue("signupDepartment")
          });
      } catch (error) {
        runAnimation("shake", form.closest(".auth-card"));
        alert(error.message);
        return;
      }

      if (!result.success) {
        runAnimation("shake", form.closest(".auth-card"));
      }

      alert(result.message);

      if (result.success) {
        form.reset();

        showLoginPage();
      }
    }
  );
}


/* =========================
   FORM INVENTARIS
========================= */

function setupItemForm() {
  const form =
    $("itemForm");

  if (!form) {
    return;
  }

  form.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      saveItemFromForm();
    }
  );
}


/* =========================
   FORM PEMINJAMAN
========================= */

function setupLoanForm() {
  const form =
    $("loanForm");

  if (!form) {
    return;
  }

  form.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      saveLoanFromForm();
    }
  );
}


/* =========================
   NAVIGASI
========================= */

function setupNavigation() {
  document.addEventListener(
    "click",
    event => {
      const link =
        event.target.closest(
          "[data-target]"
        );

      if (!link) {
        return;
      }

      event.preventDefault();

      const target =
        link.dataset.target;

      if (
        target === "accounts" &&
        !isAdmin()
      ) {
        alert(
          "Menu ini hanya untuk Admin."
        );

        return;
      }

      showSection(target);
    }
  );
}


/* =========================
   TOMBOL UMUM
========================= */

function setupButtons() {
  const logoutButton =
    $("logoutButton");

  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      logout
    );
  }

  const addItemButton =
    $("addItemButton");

  if (addItemButton) {
    addItemButton.addEventListener(
      "click",
      () => openItemModal()
    );
  }

  const addLoanButton =
    $("addLoanButton");

  if (addLoanButton) {
    addLoanButton.addEventListener(
      "click",
      () => openLoanModal()
    );
  }

  const closeItemButton =
    $("closeItemModal");

  if (closeItemButton) {
    closeItemButton.addEventListener(
      "click",
      closeItemModal
    );
  }

  const closeLoanButton =
    $("closeLoanModal");

  if (closeLoanButton) {
    closeLoanButton.addEventListener(
      "click",
      closeLoanModal
    );
  }

  const showSignupButton =
    $("showSignupButton");

  if (showSignupButton) {
    showSignupButton.addEventListener(
      "click",
      showSignupPage
    );
  }

  const showLoginButton =
    $("showLoginButton");

  if (showLoginButton) {
    showLoginButton.addEventListener(
      "click",
      showLoginPage
    );
  }
}


/* =========================
   FILTER INVENTARIS
========================= */

function setupInventoryFilter() {
  const filter =
    $("inventoryDepartmentFilter");

  if (!filter) {
    return;
  }

  /* Tampil/sembunyi filter diatur lewat
     data-admin-only di renderUserInfo() */
  filter.addEventListener(
    "change",
    renderInventory
  );

  const search =
    $("inventorySearch");

  if (search) {
    search.addEventListener(
      "input",
      renderInventory
    );

    /* Esc = hapus pencarian */
    search.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape" && search.value) {
          search.value = "";
          renderInventory();
        }
      }
    );
  }

  /* Tombol "/" = langsung ke kotak cari (di halaman Inventaris) */
  document.addEventListener(
    "keydown",
    event => {
      const typing =
        event.target.closest?.("input, textarea, select");

      const inventoryOpen =
        !document
          .querySelector('[data-section="inventory"]')
          ?.classList.contains("hidden");

      if (
        event.key === "/" &&
        !typing &&
        inventoryOpen &&
        search
      ) {
        event.preventDefault();
        search.focus();
      }
    }
  );
}


/* =========================
   SIGNUP PAGE
========================= */

function showSignupPage() {
  hideAllPages();

  const page =
    $("signupPage");

  if (page) {
    page.classList.remove("hidden");
  }

  runAnimation("authCard", page);
}


/* =========================
   HELPER FORM
========================= */

function getValue(id) {
  const element =
    $(id);

  return element
    ? element.value
    : "";
}

function setValue(id, value) {
  const element =
    $(id);

  if (element) {
    element.value =
      value ?? "";
  }
}

function setText(id, value) {
  const element =
    $(id);

  if (element) {
    element.textContent =
      value ?? "";
  }
}


/* =========================
   MODAL CLICK OUTSIDE
========================= */

function setupModalOutsideClick() {
  document.addEventListener(
    "click",
    event => {
      if (
        event.target ===
        $("itemModal")
      ) {
        closeItemModal();
      }

      if (
        event.target ===
        $("loanModal")
      ) {
        closeLoanModal();
      }

      if (
        event.target ===
        $("docModal")
      ) {
        closeDocModal();
      }
    }
  );
}


/* =========================
   INISIALISASI
========================= */

async function init() {
  populateSelects();

  setupAdminForm();
  setupLoginForm();
  setupSignupForm();
  setupItemForm();
  setupLoanForm();

  setupNavigation();
  setupButtons();

  setupInventoryFilter();
  setupModalOutsideClick();
  setupDocForms();

  startClock();

  /* Sudah login? Sudah ada Admin? */
  try {
    const status =
      await api("status");

    adminExists =
      status.adaAdmin;

    if (status.akun) {
      await refreshData();
    }
  } catch (error) {
    alert(error.message);
  }

  if (currentUser) {
    showAppPage();
    renderAll();
  } else {
    showLoginPage();
  }
}


/* =========================
   GLOBAL FUNCTIONS
========================= */

window.logout =
  logout;

window.showLoginPage =
  showLoginPage;

window.showSignupPage =
  showSignupPage;

window.showSection =
  showSection;

window.openItemModal =
  openItemModal;

window.closeItemModal =
  closeItemModal;

window.deleteItem =
  deleteItem;

window.openLoanModal =
  openLoanModal;

window.closeLoanModal =
  closeLoanModal;

window.returnLoan =
  returnLoan;

window.deleteLoan =
  deleteLoan;

window.openDocModal =
  openDocModal;

window.closeDocModal =
  closeDocModal;

window.deleteDoc =
  deleteDoc;

window.approveUser =
  approveUser;

window.rejectUser =
  rejectUser;


/* =========================
   START
========================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);



/* =========================================
   GRAFIK INVENTARIS HISADA
========================================= */

let conditionChartInstance = null;
let departmentChartInstance = null;

function renderInventoryCharts() {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js belum dimuat.");
    return;
  }

  const data = visibleItems();

  const good = data.reduce(
    (sum, item) => sum + normalizeNumber(item.good), 0
  );

  const fair = data.reduce(
    (sum, item) => sum + normalizeNumber(item.fair), 0
  );

  const bad = data.reduce(
    (sum, item) => sum + normalizeNumber(item.bad), 0
  );

  const lost = data.reduce(
    (sum, item) => sum + normalizeNumber(item.lost), 0
  );

  const conditionCanvas = document.getElementById("conditionChart");

  if (conditionCanvas) {
    if (conditionChartInstance) {
      conditionChartInstance.destroy();
    }

    conditionChartInstance = new Chart(conditionCanvas, {
      type: "doughnut",
      data: {
        labels: ["Baik", "Kurang Baik", "Rusak Berat", "Hilang"],
        datasets: [{
          data: [good, fair, bad, lost],
          backgroundColor: ["#22a06b", "#f4c542", "#e05252", "#64748b"],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom"
          }
        }
      }
    });
  }

  const departmentCanvas = document.getElementById("departmentChart");

  if (departmentCanvas) {
    if (departmentChartInstance) {
      departmentChartInstance.destroy();
    }

    const departments = isAdmin()
      ? DEPTS
      : [getUserDept()];

    const departmentTotals = departments.map(dept =>
      data
        .filter(item => item.department === dept)
        .reduce((sum, item) => sum + itemTotal(item), 0)
    );

    departmentChartInstance = new Chart(departmentCanvas, {
      type: "bar",
      data: {
        labels: departments,
        datasets: [{
          label: "Jumlah Barang",
          data: departmentTotals,
          backgroundColor: "#279568",
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}
