/* =========================================================
   HISADA INVENTARIS V4
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

/* Akun Admin tidak lagi ditulis di kode.
   Dibuat sekali lewat layar "Buat Akun Admin". */
const ADMIN_KEY = "hisada_admin_v4";

const TIME_ZONE = "Asia/Jakarta";

const USERS_KEY = "hisada_users_v4";
const ITEMS_KEY = "hisada_items_v4";
const LOANS_KEY = "hisada_loans_v4";
const SESSION_KEY = "hisada_session_v4";

let currentUser = null;
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

function uid() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

function now() {
  return new Date().toISOString();
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
   LOCAL STORAGE
========================= */

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    const data = JSON.parse(raw);

    return data ?? fallback;
  } catch (error) {
    console.error("Gagal membaca:", key, error);
    return fallback;
  }
}

function saveJSON(key, data) {
  localStorage.setItem(
    key,
    JSON.stringify(data)
  );
}

function users() {
  return loadJSON(USERS_KEY, []);
}

function saveUsers(data) {
  saveJSON(USERS_KEY, data);
}

function items() {
  return loadJSON(ITEMS_KEY, []);
}

function saveItems(data) {
  saveJSON(ITEMS_KEY, data);
}

function loans() {
  return loadJSON(LOANS_KEY, []);
}

function saveLoans(data) {
  saveJSON(LOANS_KEY, data);
}

function adminAccount() {
  return loadJSON(ADMIN_KEY, null);
}


/* =========================
   PASSWORD (HASH)
========================= */

/* Password disimpan sebagai hash SHA-256 + salt,
   bukan teks aslinya */
async function hashPassword(password, salt) {
  if (!window.crypto?.subtle) {
    throw new Error(
      "Browser ini tidak mendukung enkripsi. Buka lewat https (GitHub Pages)."
    );
  }

  const bytes =
    new TextEncoder().encode(
      `${salt}:${password}`
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makePasswordFields(password) {
  const passwordSalt =
    uid();

  return {
    passwordSalt,
    passwordHash:
      await hashPassword(password, passwordSalt)
  };
}

/* Mendukung akun lama yang passwordnya
   masih tersimpan apa adanya */
async function checkPassword(account, password) {
  if (account.passwordHash) {
    return (
      await hashPassword(
        password,
        account.passwordSalt
      )
    ) === account.passwordHash;
  }

  return account.password === password;
}


/* =========================
   SESSION
========================= */

/* Salinan data user tanpa password */
function publicUser(user) {
  const copy = {
    ...user
  };

  delete copy.password;
  delete copy.passwordHash;
  delete copy.passwordSalt;

  return copy;
}

/* Session hanya menyimpan username */
function saveSession() {
  if (currentUser) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: currentUser.username
      })
    );
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

/* Data user selalu dicek ulang, jadi akun yang
   dinonaktifkan Admin langsung keluar */
function loadSession() {
  const saved =
    loadJSON(SESSION_KEY, null);

  const username =
    saved?.username || "";

  currentUser = null;

  const admin =
    adminAccount();

  if (
    admin &&
    username === admin.username
  ) {
    currentUser =
      publicUser(admin);
  } else if (username) {
    const user =
      users().find(
        item =>
          item.username === username
      );

    if (
      user &&
      user.status === "approved"
    ) {
      currentUser =
        publicUser(user);
    }
  }

  saveSession();
}

function logout() {
  currentUser = null;
  saveSession();

  showLoginPage();
}


/* =========================
   DATA MIGRASI
========================= */

function migrateOldData() {
  const oldItems =
    loadJSON("hisada_items_v3", null);

  const newItems =
    localStorage.getItem(ITEMS_KEY);

  if (
    Array.isArray(oldItems) &&
    !newItems
  ) {
    const converted = oldItems.map(item => {
      const quantity =
        normalizeNumber(item.quantity);

      let good = 0;
      let fair = 0;
      let bad = 0;
      let lost = 0;

      switch (item.condition) {
        case "Baik":
          good = quantity;
          break;

        case "Kurang Baik":
          fair = quantity;
          break;

        case "Rusak Berat":
          bad = quantity;
          break;

        case "Hilang":
          lost = quantity;
          break;

        default:
          good = quantity;
      }

      return {
        id: item.id || uid(),
        code: item.code || "",
        department:
          item.department || "",
        name:
          item.name || item.itemName || "",
        good,
        fair,
        bad,
        lost,
        description:
          item.description || "",
        createdAt:
          item.createdAt || now(),
        updatedAt:
          item.updatedAt || now()
      };
    });

    saveItems(converted);
  }
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
   NOMOR BARANG
========================= */

function deptCode(dept) {
  const codes = {
    "Logistik": "LOG",
    "Bahasa": "BHS",
    "Kesehatan": "KES",
    "Ta'mir Masjid": "TMR",
    "Keamanan": "KAM",
    "Pramuka": "PRM",
    "Olahraga": "OLR",
    "Dewan Harian": "DWH",
    "Dapur": "DAP",
    "Kesenian": "KSN"
  };

  return codes[dept] || "HSD";
}

function nextItemCode(dept, ignoreId = null) {
  const prefix =
    deptCode(dept) + "-";

  const data = items();

  let highest = 0;

  data.forEach(item => {
    if (
      item.id === ignoreId ||
      item.department !== dept
    ) {
      return;
    }

    const code =
      String(item.code || "");

    if (!code.startsWith(prefix)) {
      return;
    }

    const number =
      parseInt(
        code.slice(prefix.length),
        10
      );

    if (
      Number.isFinite(number) &&
      number > highest
    ) {
      highest = number;
    }
  });

  return (
    prefix +
    String(highest + 1).padStart(3, "0")
  );
}

function nextLoanCode() {
  const data = loans();

  let highest = 0;

  data.forEach(loan => {
    const code =
      String(loan.code || "");

    if (!code.startsWith("PJM-")) {
      return;
    }

    const number =
      parseInt(
        code.slice(4),
        10
      );

    if (
      Number.isFinite(number) &&
      number > highest
    ) {
      highest = number;
    }
  });

  return (
    "PJM-" +
    String(highest + 1).padStart(3, "0")
  );
}


/* =========================
   TOTAL INVENTARIS
========================= */

/* Total = barang yang masih ada (tanpa Hilang) */
function itemTotal(item) {
  return (
    normalizeNumber(item.good) +
    normalizeNumber(item.fair) +
    normalizeNumber(item.bad)
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

/* Yang bisa dipinjam: kondisi Baik + Kurang Baik
   dikurangi yang sedang dipinjam */
function availableCount(item, ignoreLoanId = null) {
  return Math.max(
    0,
    normalizeNumber(item.good) +
      normalizeNumber(item.fair) -
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

  /* Belum ada Admin di browser ini */
  const page =
    adminAccount()
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
  if (adminAccount()) {
    return {
      success: false,
      message:
        "Akun Admin sudah ada."
    };
  }

  const username =
    String(data.username || "").trim();

  const password =
    String(data.password || "");

  if (!username) {
    return {
      success: false,
      message:
        "Username wajib diisi."
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message:
        "Password minimal 8 karakter."
    };
  }

  if (password !== data.confirm) {
    return {
      success: false,
      message:
        "Ulangi password tidak sama."
    };
  }

  if (
    users().some(
      user =>
        user.username === username
    )
  ) {
    return {
      success: false,
      message:
        "Username sudah dipakai akun bagian."
    };
  }

  saveJSON(ADMIN_KEY, {
    id: uid(),
    username,
    ...(await makePasswordFields(password)),
    name: "Admin HISADA",
    role: "admin",
    status: "approved",
    createdAt: now()
  });

  return {
    success: true,
    message:
      "Akun Admin berhasil dibuat. Silakan login."
  };
}


/* =========================
   LOGIN
========================= */

async function login(username, password) {
  username =
    String(username || "").trim();

  password =
    String(password || "");

  const admin =
    adminAccount();

  if (
    admin &&
    username === admin.username
  ) {
    if (
      !(await checkPassword(admin, password))
    ) {
      return {
        success: false,
        message: "Password salah."
      };
    }

    currentUser =
      publicUser(admin);

    saveSession();
    showAppPage();
    return {
      success: true
    };
  }

  const dataUsers =
    users();

  const user =
    dataUsers.find(
      item =>
        item.username === username
    );

  if (!user) {
    return {
      success: false,
      message: "Username tidak ditemukan."
    };
  }

  if (
    !(await checkPassword(user, password))
  ) {
    return {
      success: false,
      message: "Password salah."
    };
  }

  if (
    user.status !== "approved"
  ) {
    return {
      success: false,
      message:
        user.status === "pending"
          ? "Akun masih menunggu persetujuan Admin."
          : "Akun tidak disetujui."
    };
  }

  /* Akun lama: ganti password teks asli menjadi hash */
  if (!user.passwordHash) {
    Object.assign(
      user,
      await makePasswordFields(password)
    );

    delete user.password;

    saveUsers(dataUsers);
  }

  currentUser =
    publicUser(user);

  saveSession();
  showAppPage();

  return {
    success: true
  };
}


/* =========================
   SIGN UP
========================= */

async function signup(data) {
  const username =
    String(data.username || "").trim();

  const password =
    String(data.password || "");

  const name =
    String(data.name || "").trim();

  const department =
    String(data.department || "").trim();

  if (
    !username ||
    !password ||
    !name ||
    !department
  ) {
    return {
      success: false,
      message:
        "Semua data harus diisi."
    };
  }

  if (!DEPTS.includes(department)) {
    return {
      success: false,
      message:
        "Bagian tidak valid."
    };
  }

  if (
    username === adminAccount()?.username
  ) {
    return {
      success: false,
      message:
        "Username tersebut khusus Admin."
    };
  }

  const dataUsers =
    users();

  const exists =
    dataUsers.some(
      user =>
        user.username === username
    );

  if (exists) {
    return {
      success: false,
      message:
        "Username sudah digunakan."
    };
  }

  dataUsers.push({
    id: uid(),
    username,
    ...(await makePasswordFields(password)),
    name,
    department,
    role: "bagian",
    status: "pending",
    createdAt: now()
  });

  saveUsers(dataUsers);

  return {
    success: true,
    message:
      "Pendaftaran berhasil. Tunggu persetujuan Admin."
  };
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

  /* Total tanpa Hilang */
  const total =
    totalGood +
    totalFair +
    totalBad;

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

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11">
          Belum ada data inventaris.
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

          <button
            class="btn btn-small btn-danger"
            onclick="deleteItem('${item.id}')"
          >
            Hapus
          </button>
        `;

      return `
        <tr>
          <td>${escapeHTML(item.code)}</td>

          <td>
            ${escapeHTML(item.name)}
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
            ${escapeHTML(item.department)}
          </td>

          <td>
            ${escapeHTML(item.description || "-")}
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

function saveItemFromForm() {
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

  const department =
    isAdmin()
      ? getValue("itemDepartment")
      : getUserDept();

  if (!name) {
    alert("Nama barang wajib diisi.");
    return;
  }

  if (
    !DEPTS.includes(department)
  ) {
    alert("Bagian tidak valid.");
    return;
  }

  const good =
    normalizeNumber(
      getValue("itemGood")
    );

  const fair =
    normalizeNumber(
      getValue("itemFair")
    );

  const bad =
    normalizeNumber(
      getValue("itemBad")
    );

  const lost =
    normalizeNumber(
      getValue("itemLost")
    );

  const description =
    String(
      getValue("itemDescription")
    ).trim();

  const data =
    items();

  if (editingItemId) {
    const index =
      data.findIndex(
        item =>
          item.id === editingItemId
      );

    if (index < 0) {
      alert("Data tidak ditemukan.");
      return;
    }

    const old =
      data[index];

    if (
      !isAdmin() &&
      old.department !== getUserDept()
    ) {
      alert("Akses ditolak.");
      return;
    }

    const borrowed =
      borrowedCount(old.id);

    if (
      borrowed > 0 &&
      department !== old.department
    ) {
      alert(
        `Barang ini masih dipinjam ${borrowed} unit. Kembalikan dulu sebelum pindah bagian.`
      );
      return;
    }

    if (good + fair < borrowed) {
      alert(
        `Masih ada ${borrowed} unit yang dipinjam. Jumlah Baik + Kurang Baik tidak boleh kurang dari itu.`
      );
      return;
    }

    /* Pindah bagian = nomor barang ikut bagian baru */
    const code =
      department !== old.department
        ? nextItemCode(department, old.id)
        : old.code;

    data[index] = {
      ...old,
      code,
      name,
      department,
      good,
      fair,
      bad,
      lost,
      description,
      updatedAt: now()
    };
  } else {
    data.push({
      id: uid(),
      code:
        nextItemCode(department),
      name,
      department,
      good,
      fair,
      bad,
      lost,
      description,
      createdAt: now(),
      updatedAt: now()
    });
  }

  saveItems(data);

  closeItemModal();

  renderInventory();
  renderDashboard();
}


/* =========================
   HAPUS INVENTARIS
========================= */

function deleteItem(id) {
  const data =
    items();

  const item =
    data.find(
      value =>
        value.id === id
    );

  if (!item) {
    return;
  }

  if (
    !isAdmin() &&
    item.department !== getUserDept()
  ) {
    alert("Akses ditolak.");
    return;
  }

  const borrowed =
    borrowedCount(item.id);

  if (borrowed > 0) {
    alert(
      `Barang ini masih dipinjam ${borrowed} unit. Kembalikan dulu sebelum dihapus.`
    );
    return;
  }

  if (
    !confirm(
      `Hapus barang "${item.name}"?`
    )
  ) {
    return;
  }

  saveItems(
    data.filter(
      value =>
        value.id !== id
    )
  );

  renderInventory();
  renderDashboard();
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

function saveLoanFromForm() {
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

  const note =
    String(
      getValue("loanNote")
    ).trim();

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

  /* Bagian peminjaman selalu ikut bagian pemilik barang */
  const item =
    visibleItems().find(
      value =>
        value.id === itemId
    );

  if (!item) {
    alert("Barang tidak ditemukan.");
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

  const data =
    loans();

  const old =
    editingLoanId
      ? data.find(
          loan =>
            loan.id === editingLoanId
        )
      : null;

  if (editingLoanId && !old) {
    alert("Data tidak ditemukan.");
    return;
  }

  if (
    old &&
    !isAdmin() &&
    old.department !== getUserDept()
  ) {
    alert("Akses ditolak.");
    return;
  }

  /* Cek stok, kecuali pinjaman yang sudah dikembalikan */
  if (
    old?.status !== "Dikembalikan"
  ) {
    const available =
      availableCount(item, editingLoanId);

    if (quantity > available) {
      alert(
        `Stok tidak cukup. Yang bisa dipinjam: ${available} unit.`
      );
      return;
    }
  }

  const values = {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    quantity,
    borrower,
    borrowDate,
    returnPlan,
    department: item.department,
    note,
    updatedAt: now()
  };

  if (old) {
    Object.assign(old, values);
  } else {
    data.push({
      id: uid(),
      code: nextLoanCode(),
      ...values,
      status: "Dipinjam",
      createdAt: now(),
      returnedAt: null
    });
  }

  saveLoans(data);

  closeLoanModal();
  renderLoans();
  renderDashboard();
}


/* =========================
   KEMBALIKAN BARANG
========================= */

function returnLoan(id) {
  const data =
    loans();

  const index =
    data.findIndex(
      loan =>
        loan.id === id
    );

  if (index < 0) {
    return;
  }

  const loan =
    data[index];

  if (
    !isAdmin() &&
    loan.department !== getUserDept()
  ) {
    alert("Akses ditolak.");
    return;
  }

  if (
    loan.status === "Dikembalikan"
  ) {
    return;
  }

  if (
    !confirm(
      "Tandai peminjaman ini sebagai dikembalikan?"
    )
  ) {
    return;
  }

  data[index] = {
    ...loan,
    status: "Dikembalikan",
    returnedAt: now(),
    updatedAt: now()
  };

  saveLoans(data);

  renderLoans();
}

function deleteLoan(id) {
  const data =
    loans();

  const loan =
    data.find(
      value =>
        value.id === id
    );

  if (!loan) {
    return;
  }

  if (
    !isAdmin() &&
    loan.department !== getUserDept()
  ) {
    alert("Akses ditolak.");
    return;
  }

  if (
    !confirm(
      "Hapus data peminjaman ini?"
    )
  ) {
    return;
  }

  saveLoans(
    data.filter(
      value =>
        value.id !== id
    )
  );

  renderLoans();
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

function approveUser(id) {
  if (!isAdmin()) {
    return;
  }

  const data =
    users();

  const index =
    data.findIndex(
      user =>
        user.id === id
    );

  if (index < 0) {
    return;
  }

  data[index].status =
    "approved";

  saveUsers(data);

  renderAccounts();
}

function rejectUser(id) {
  if (!isAdmin()) {
    return;
  }

  const data =
    users();

  const index =
    data.findIndex(
      user =>
        user.id === id
    );

  if (index < 0) {
    return;
  }

  if (
    !confirm(
      "Nonaktifkan akun ini?"
    )
  ) {
    return;
  }

  data[index].status =
    "rejected";

  saveUsers(data);

  renderAccounts();
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
    }
  );
}


/* =========================
   INISIALISASI
========================= */

function init() {
  migrateOldData();

  loadSession();

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

  startClock();

  if (currentUser) {
    renderUserInfo();
    showAppPage();
  } else {
    showLoginPage();
  }

  renderDashboard();
  renderInventory();
  renderLoans();
  renderAccounts();
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
