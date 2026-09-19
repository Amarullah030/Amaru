/* =========================================================
   HISADA INVENTARIS V4
   ========================================================= */

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

const ADMIN = {
  username: "216416",
  password: "Amarullah060308",
  name: "Admin HISADA",
  role: "admin",
  status: "approved"
};

const USERS_KEY = "hisada_users_v4";
const ITEMS_KEY = "hisada_items_v4";
const LOANS_KEY = "hisada_loans_v4";
const SESSION_KEY = "hisada_session_v4";

let currentUser = null;


/* =========================================================
   UTILITAS
   ========================================================= */

const $ = id => document.getElementById(id);

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));

const read = (key, defaultValue = []) => {
  try {
    return JSON.parse(
      localStorage.getItem(key) ||
      JSON.stringify(defaultValue)
    );
  } catch {
    return defaultValue;
  }
};

const write = (key, value) =>
  localStorage.setItem(key, JSON.stringify(value));

const users = () => read(USERS_KEY);
const items = () => read(ITEMS_KEY);
const loans = () => read(LOANS_KEY);

const saveUsers = value => write(USERS_KEY, value);
const saveItems = value => write(ITEMS_KEY, value);
const saveLoans = value => write(LOANS_KEY, value);

const isAdmin = () =>
  currentUser?.role === "admin";

const visibleDept = () =>
  isAdmin() ? null : currentUser?.department;


/* =========================================================
   FILTER DATA SESUAI BAGIAN
   ========================================================= */

function visibleItems() {
  const data = items();

  if (isAdmin()) {
    return data;
  }

  return data.filter(
    item => item.department === visibleDept()
  );
}

function visibleLoans() {
  const data = loans();

  if (isAdmin()) {
    return data;
  }

  return data.filter(
    loan => loan.department === visibleDept()
  );
}


/* =========================================================
   TOTAL BARANG
   ========================================================= */

function total(item) {
  return [
    "good",
    "fair",
    "bad",
    "lost"
  ].reduce(
    (sum, key) => sum + (Number(item[key]) || 0),
    0
  );
}


/* =========================================================
   NOMOR OTOMATIS BARANG
   ========================================================= */

function deptCode(department) {

  if (department === "Ta'mir Masjid") {
    return "TAM";
  }

  return department
    .split(/\s+/)
    .map(word => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}


function nextNumber(department, data = items()) {

  const prefix = deptCode(department) + "-";

  const numbers = data
    .filter(item => item.department === department)
    .map(item =>
      Number(
        String(item.number || "")
          .replace(prefix, "")
      ) || 0
    );

  const next =
    Math.max(0, ...numbers) + 1;

  return (
    prefix +
    String(next).padStart(3, "0")
  );
}


/* =========================================================
   NOMOR PEMINJAMAN OTOMATIS
   ========================================================= */

function nextLoan() {

  const numbers = loans()
    .map(loan =>
      Number(
        String(loan.id || "")
          .replace("PJM-", "")
      ) || 0
    );

  const next =
    Math.max(0, ...numbers) + 1;

  return (
    "PJM-" +
    String(next).padStart(3, "0")
  );
}


/* =========================================================
   SAAT HALAMAN DIMUAT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    populateSelects();
    bindEvents();

    const session =
      read(SESSION_KEY, null);

    if (session) {

      currentUser = session;
      startApp();

    } else {

      showAuthPage();
    }
  }
);


/* =========================================================
   ISI SELECT BAGIAN
   ========================================================= */

function populateSelects() {

  [
    "signDept",
    "itemDepartment",
    "loanDepartment",
    "departmentFilter"
  ].forEach(id => {

    const element = $(id);

    if (!element) {
      return;
    }

    DEPTS.forEach(department => {

      const option =
        document.createElement("option");

      option.value = department;
      option.textContent = department;

      element.appendChild(option);
    });
  });

  const filter =
    $("departmentFilter");

  if (
    filter &&
    !filter.querySelector(
      'option[value="all"]'
    )
  ) {

    const option =
      document.createElement("option");

    option.value = "all";
    option.textContent = "Semua Bagian";

    filter.insertBefore(
      option,
      filter.firstChild
    );
  }
}


/* =========================================================
   EVENT
   ========================================================= */

function bindEvents() {

  $("loginForm")?.addEventListener(
    "submit",
    login
  );

  $("signupForm")?.addEventListener(
    "submit",
    signup
  );

  $("itemForm")?.addEventListener(
    "submit",
    saveItem
  );

  $("loanForm")?.addEventListener(
    "submit",
    saveLoan
  );

  $("loanDepartment")?.addEventListener(
    "change",
    populateLoanItems
  );
}


/* =========================================================
   LOGIN / SIGN UP
   ========================================================= */

function showAuth(type) {

  $("loginForm")?.classList.toggle(
    "hidden",
    type !== "login"
  );

  $("signupForm")?.classList.toggle(
    "hidden",
    type !== "signup"
  );

  $("loginTab")?.classList.toggle(
    "active",
    type === "login"
  );

  $("signupTab")?.classList.toggle(
    "active",
    type === "signup"
  );
}


function showAuthPage() {

  $("authPage")?.classList.remove(
    "hidden"
  );

  $("appPage")?.classList.add(
    "hidden"
  );
}


/* =========================================================
   LOGIN
   ========================================================= */

function login(event) {

  event.preventDefault();

  const username =
    $("loginUser").value.trim();

  const password =
    $("loginPass").value;

  const message =
    $("loginMessage");


  /* ADMIN */

  if (
    username === ADMIN.username &&
    password === ADMIN.password
  ) {

    currentUser = {
      ...ADMIN
    };

    write(
      SESSION_KEY,
      currentUser
    );

    startApp();

    return;
  }


  /* USER BIASA */

  const user =
    users().find(
      item => item.username === username
    );


  if (
    !user ||
    user.password !== password
  ) {

    message.textContent =
      "Username atau password salah.";

    return;
  }


  if (
    user.status !== "approved"
  ) {

    message.textContent =
      "Akun masih menunggu persetujuan Admin.";

    return;
  }


  currentUser = user;

  write(
    SESSION_KEY,
    currentUser
  );

  startApp();
}


/* =========================================================
   SIGN UP
   ========================================================= */

function signup(event) {

  event.preventDefault();

  const name =
    $("signName").value.trim();

  const username =
    $("signUser").value.trim();

  const password =
    $("signPass").value;

  const department =
    $("signDept").value;

  const message =
    $("signupMessage");


  if (
    !name ||
    !username ||
    !password ||
    !department
  ) {

    message.textContent =
      "Semua data wajib diisi.";

    return;
  }


  if (
    username === ADMIN.username ||
    users().some(
      user =>
        user.username.toLowerCase() ===
        username.toLowerCase()
    )
  ) {

    message.textContent =
      "Username sudah digunakan.";

    return;
  }


  const newUser = {

    id: crypto.randomUUID(),

    name,

    username,

    password,

    department,

    role: "bagian",

    status: "pending",

    createdAt:
      new Date().toISOString()
  };


  const data = users();

  data.push(newUser);

  saveUsers(data);


  message.textContent =
    "Pendaftaran berhasil. Tunggu persetujuan Admin.";

  event.target.reset();
}


/* =========================================================
   MULAI APLIKASI
   ========================================================= */

function startApp() {

  $("authPage").classList.add(
    "hidden"
  );

  $("appPage").classList.remove(
    "hidden"
  );

  updateUserUI();

  setupPermissions();

  showPage("dashboard");
}


/* =========================================================
   LOGOUT
   ========================================================= */

function logout() {

  currentUser = null;

  localStorage.removeItem(
    SESSION_KEY
  );

  showAuthPage();
}


/* =========================================================
   USER UI
   ========================================================= */

function updateUserUI() {

  [
    "sidebarUserName",
    "topbarUser",
    "welcomeName"
  ].forEach(id => {

    if ($(id)) {
      $(id).textContent =
        currentUser.name;
    }
  });


  if ($("sidebarUserRole")) {

    $("sidebarUserRole").textContent =
      isAdmin()
        ? "Administrator"
        : currentUser.department;
  }
}


/* =========================================================
   PERMISSION
   ========================================================= */

function setupPermissions() {

  document
    .querySelectorAll(".admin-only")
    .forEach(element => {

      element.classList.toggle(
        "hidden",
        !isAdmin()
      );
    });


  if ($("itemDepartment")) {

    $("itemDepartment").disabled =
      !isAdmin();

    if (!isAdmin()) {

      $("itemDepartment").value =
        currentUser.department;
    }
  }


  if ($("loanDepartment")) {

    $("loanDepartment").disabled =
      !isAdmin();

    if (!isAdmin()) {

      $("loanDepartment").value =
        currentUser.department;
    }
  }
}


/* =========================================================
   NAVIGASI HALAMAN
   ========================================================= */

function showPage(page) {

  [
    "dashboard",
    "inventory",
    "loans",
    "accounts"
  ].forEach(name => {

    $(name + "Page")
      ?.classList.toggle(
        "hidden",
        name !== page
      );
  });


  document
    .querySelectorAll(".nav-item")
    .forEach(element => {

      element.classList.toggle(
        "active",
        element.dataset.page === page
      );
    });


  const titles = {

    dashboard: [
      "Dashboard",
      "Ringkasan inventaris HISADA"
    ],

    inventory: [
      "Inventaris",
      "Kelola data barang inventaris"
    ],

    loans: [
      "Peminjaman",
      "Data peminjaman barang"
    ],

    accounts: [
      "Akun",
      "Manajemen akun pengguna"
    ]
  };


  const title =
    titles[page] || ["", ""];


  if ($("pageTitle")) {
    $("pageTitle").textContent =
      title[0];
  }


  if ($("pageSubtitle")) {
    $("pageSubtitle").textContent =
      title[1];
  }


  if (page === "dashboard") {
    renderDashboard();
  }


  if (page === "inventory") {
    renderInventory();
  }


  if (page === "loans") {

    populateLoanItems();

    renderLoans();
  }


  if (
    page === "accounts" &&
    isAdmin()
  ) {

    renderAccounts();
  }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  const data =
    visibleItems();


  const stats = {

    good: 0,

    fair: 0,

    bad: 0,

    lost: 0,

    total: 0
  };


  data.forEach(item => {

    stats.good +=
      Number(item.good) || 0;

    stats.fair +=
      Number(item.fair) || 0;

    stats.bad +=
      Number(item.bad) || 0;

    stats.lost +=
      Number(item.lost) || 0;
  });


  stats.total =
    stats.good +
    stats.fair +
    stats.bad +
    stats.lost;


  [
    "good",
    "fair",
    "bad",
    "lost",
    "total"
  ].forEach(key => {

    const element =
      $(
        "stat" +
        key[0].toUpperCase() +
        key.slice(1)
      );

    if (element) {
      element.textContent =
        stats[key];
    }
  });


  const container =
    $("departmentSummary");

  if (!container) {
    return;
  }


  container.innerHTML = "";


  const departments =
    isAdmin()
      ? DEPTS
      : [currentUser.department];


  departments.forEach(department => {

    const departmentItems =
      data.filter(
        item =>
          item.department === department
      );


    const result = {

      good: 0,

      fair: 0,

      bad: 0,

      lost: 0
    };


    departmentItems.forEach(item => {

      result.good +=
        Number(item.good) || 0;

      result.fair +=
        Number(item.fair) || 0;

      result.bad +=
        Number(item.bad) || 0;

      result.lost +=
        Number(item.lost) || 0;
    });


    const departmentTotal =
      result.good +
      result.fair +
      result.bad +
      result.lost;


    container.insertAdjacentHTML(
      "beforeend",

      `
      <div class="department-card">

        <strong>
          ${esc(department)}
        </strong>

        <span>
          Total ${departmentTotal} unit
        </span>

        <small>
          Baik ${result.good}
          · Kurang ${result.fair}
          · Rusak ${result.bad}
          · Hilang ${result.lost}
        </small>

      </div>
      `
    );
  });
}


/* =========================================================
   INVENTARIS
   ========================================================= */

function renderInventory() {

  let data =
    visibleItems();


  const search =
    (
      $("searchInput")?.value ||
      ""
    )
      .toLowerCase()
      .trim();


  const department =
    $("departmentFilter")?.value ||
    "all";


  if (search) {

    data = data.filter(item =>

      item.name
        .toLowerCase()
        .includes(search) ||

      item.number
        .toLowerCase()
        .includes(search)
    );
  }


  if (
    isAdmin() &&
    department !== "all"
  ) {

    data =
      data.filter(
        item =>
          item.department === department
      );
  }


  const body =
    $("inventoryBody");

  if (!body) {
    return;
  }


  if (!data.length) {

    body.innerHTML = `
      <tr>
        <td
          colspan="10"
          class="empty-cell"
        >
          Belum ada data inventaris.
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    data.map(item => `

      <tr>

        <td>
          <b>
            ${esc(item.number)}
          </b>
        </td>

        <td>
          ${esc(item.department)}
        </td>

        <td>
          ${esc(item.name)}
        </td>

        <td>
          <b>
            ${total(item)}
          </b>
        </td>

        <td>
          ${item.good || 0}
        </td>

        <td>
          ${item.fair || 0}
        </td>

        <td>
          ${item.bad || 0}
        </td>

        <td>
          ${item.lost || 0}
        </td>

        <td>
          ${esc(item.description || "-")}
        </td>

        <td>

          <div class="action-group">

            ${
              canEdit(item)
              ?

              `
              <button
                class="small-btn edit-btn"
                onclick="openEditItem('${item.id}')"
              >
                Edit
              </button>

              <button
                class="small-btn delete-btn"
                onclick="deleteItem('${item.id}')"
              >
                Hapus
              </button>
              `

              :

              ""
            }

          </div>

        </td>

      </tr>

    `).join("");
}


/* =========================================================
   CEK AKSES INVENTARIS
   ========================================================= */

function canEdit(item) {

  return (
    isAdmin() ||
    item.department ===
      currentUser.department
  );
}


/* =========================================================
   TAMBAH BARANG
   ========================================================= */

function openAddItem() {

  $("itemForm").reset();

  $("editItemId").value = "";

  $("modalTitle").textContent =
    "Tambah Barang";


  $("itemDepartment").disabled =
    !isAdmin();


  $("itemDepartment").value =
    isAdmin()
      ? DEPTS[0]
      : currentUser.department;


  $("itemModal").classList.remove(
    "hidden"
  );
}


/* =========================================================
   EDIT BARANG
   ========================================================= */

function openEditItem(id) {

  const item =
    items().find(
      value => value.id === id
    );


  if (
    !item ||
    !canEdit(item)
  ) {

    alert(
      "Anda tidak memiliki akses."
    );

    return;
  }


  $("editItemId").value =
    item.id;

  $("itemDepartment").value =
    item.department;

  $("itemName").value =
    item.name;

  $("itemGood").value =
    item.good || 0;

  $("itemFair").value =
    item.fair || 0;

  $("itemBad").value =
    item.bad || 0;

  $("itemLost").value =
    item.lost || 0;

  $("itemDescription").value =
    item.description || "";


  $("itemDepartment").disabled =
    !isAdmin();


  $("modalTitle").textContent =
    "Edit Barang";


  $("itemModal").classList.remove(
    "hidden"
  );
}


/* =========================================================
   TUTUP MODAL BARANG
   ========================================================= */

function closeItemModal() {

  $("itemModal").classList.add(
    "hidden"
  );
}


/* =========================================================
   SIMPAN BARANG
   ========================================================= */

function saveItem(event) {

  event.preventDefault();


  let department =
    $("itemDepartment").value;


  if (!isAdmin()) {

    department =
      currentUser.department;
  }


  const item = {

    department,

    name:
      $("itemName")
        .value
        .trim(),

    good:
      Math.max(
        0,
        Number($("itemGood").value) || 0
      ),

    fair:
      Math.max(
        0,
        Number($("itemFair").value) || 0
      ),

    bad:
      Math.max(
        0,
        Number($("itemBad").value) || 0
      ),

    lost:
      Math.max(
        0,
        Number($("itemLost").value) || 0
      ),

    description:
      $("itemDescription")
        .value
        .trim()
  };


  if (!item.name) {

    alert(
      "Nama barang wajib diisi."
    );

    return;
  }


  if (total(item) <= 0) {

    alert(
      "Jumlah barang harus lebih dari 0."
    );

    return;
  }


  const data = items();

  const id =
    $("editItemId").value;


  if (id) {

    const index =
      data.findIndex(
        value => value.id === id
      );


    if (
      index < 0 ||
      !canEdit(data[index])
    ) {

      alert(
        "Anda tidak memiliki akses."
      );

      return;
    }


    data[index] = {

      ...data[index],

      ...item,

      updatedAt:
        new Date().toISOString()
    };


  } else {

    data.push({

      id:
        crypto.randomUUID(),

      number:
        nextNumber(
          department,
          data
        ),

      ...item,

      createdAt:
        new Date().toISOString()
    });
  }


  saveItems(data);

  closeItemModal();

  renderInventory();

  renderDashboard();
}


/* =========================================================
   HAPUS BARANG
   ========================================================= */

function deleteItem(id) {

  const item =
    items().find(
      value => value.id === id
    );


  if (
    !item ||
    !canEdit(item)
  ) {

    alert(
      "Anda tidak memiliki akses."
    );

    return;
  }


  if (
    confirm(
      `Hapus ${item.name}?`
    )
  ) {

    saveItems(
      items().filter(
        value => value.id !== id
      )
    );

    renderInventory();

    renderDashboard();
  }
}


/* =========================================================
   BARANG UNTUK PEMINJAMAN
   ========================================================= */

function populateLoanItems() {

  const department =
    isAdmin()
      ? $("loanDepartment").value
      : currentUser.department;


  const select =
    $("loanItem");


  if (!select) {
    return;
  }


  const data =
    items().filter(
      item =>
        item.department ===
        department
    );


  if (!data.length) {

    select.innerHTML = `
      <option value="">
        Belum ada barang
      </option>
    `;

    return;
  }


  select.innerHTML =
    data.map(item => `

      <option value="${item.id}">

        ${esc(item.number)}
        -
        ${esc(item.name)}
        (total ${total(item)})

      </option>

    `).join("");
}


/* =========================================================
   TAMBAH PEMINJAMAN
   ========================================================= */

function openAddLoan() {

  $("loanForm").reset();

  $("editLoanId").value = "";


  $("loanDepartment").disabled =
    !isAdmin();


  $("loanDepartment").value =
    isAdmin()
      ? DEPTS[0]
      : currentUser.department;


  populateLoanItems();


  $("loanDate").value =
    new Date()
      .toISOString()
      .slice(0, 10);


  $("loanStatus").value =
    "Dipinjam";


  $("loanModal").classList.remove(
    "hidden"
  );
}


/* =========================================================
   TUTUP MODAL PEMINJAMAN
   ========================================================= */

function closeLoanModal() {

  $("loanModal").classList.add(
    "hidden"
  );
}


/* =========================================================
   SIMPAN PEMINJAMAN
   ========================================================= */

function saveLoan(event) {

  event.preventDefault();


  const department =
    isAdmin()
      ? $("loanDepartment").value
      : currentUser.department;


  const item =
    items().find(
      value =>
        value.id ===
        $("loanItem").value
    );


  const quantity =
    Number($("loanQty").value) || 0;


  if (
    !item ||
    quantity <= 0
  ) {

    alert(
      "Data peminjaman belum lengkap."
    );

    return;
  }


  if (
    quantity > total(item)
  ) {

    alert(
      "Jumlah pinjaman melebihi total barang."
    );

    return;
  }


  const id =
    $("editLoanId").value;


  const data =
    loans();


  const loan = {

    department,

    itemId:
      item.id,

    itemName:
      item.name,

    qty:
      quantity,

    borrower:
      $("loanBorrower")
        .value
        .trim(),

    loanDate:
      $("loanDate").value,

    dueDate:
      $("loanDueDate").value,

    status:
      $("loanStatus").value,

    note:
      $("loanNote")
        .value
        .trim()
  };


  if (!loan.borrower) {

    alert(
      "Nama peminjam wajib diisi."
    );

    return;
  }


  if (id) {

    const index =
      data.findIndex(
        value => value.id === id
      );


    if (index >= 0) {

      data[index] = {

        ...data[index],

        ...loan
      };
    }


  } else {

    data.push({

      id:
        nextLoan(),

      ...loan,

      createdAt:
        new Date().toISOString()
    });
  }


  saveLoans(data);

  closeLoanModal();

  renderLoans();
}


/* =========================================================
   TAMPILKAN PEMINJAMAN
   ========================================================= */

function renderLoans() {

  let data =
    visibleLoans();


  const search =
    (
      $("loanSearch")?.value ||
      ""
    ).toLowerCase();


  if (search) {

    data =
      data.filter(
        loan =>
          loan.itemName
            .toLowerCase()
            .includes(search) ||

          loan.borrower
            .toLowerCase()
            .includes(search)
      );
  }


  const body =
    $("loansBody");


  if (!body) {
    return;
  }


  if (!data.length) {

    body.innerHTML = `
      <tr>
        <td
          colspan="10"
          class="empty-cell"
        >
          Belum ada data peminjaman.
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    data.map(loan => `

      <tr>

        <td>
          <b>
            ${esc(loan.id)}
          </b>
        </td>

        <td>
          ${esc(loan.department)}
        </td>

        <td>
          ${esc(loan.itemName)}
        </td>

        <td>
          ${loan.qty}
        </td>

        <td>
          ${esc(loan.borrower)}
        </td>

        <td>
          ${esc(loan.loanDate)}
        </td>

        <td>
          ${esc(loan.dueDate || "-")}
        </td>

        <td>

          <span
            class="status ${
              loan.status === "Dikembalikan"
                ? "returned"
                : "borrowed"
            }"
          >

            ${esc(loan.status)}

          </span>

        </td>

        <td>
          ${esc(loan.note || "-")}
        </td>

        <td>

          <div class="action-group">

            ${
              loan.status === "Dipinjam" &&
              canLoanEdit(loan)

              ?

              `
              <button
                class="small-btn return-btn"
                onclick="returnLoan('${loan.id}')"
              >
                Dikembalikan
              </button>
              `

              :

              ""
            }


            ${
              canLoanEdit(loan)

              ?

              `
              <button
                class="small-btn edit-btn"
                onclick="openEditLoan('${loan.id}')"
              >
                Edit
              </button>

              <button
                class="small-btn delete-btn"
                onclick="deleteLoan('${loan.id}')"
              >
                Hapus
              </button>
              `

              :

              ""
            }

          </div>

        </td>

      </tr>

    `).join("");
}


/* =========================================================
   AKSES PEMINJAMAN
   ========================================================= */

function canLoanEdit(loan) {

  return (
    isAdmin() ||
    loan.department ===
      currentUser.department
  );
}


/* =========================================================
   TANDAI DIKEMBALIKAN
   ========================================================= */

function returnLoan(id) {

  const data =
    loans();


  const index =
    data.findIndex(
      loan => loan.id === id
    );


  if (
    index < 0 ||
    !canLoanEdit(data[index])
  ) {

    return;
  }


  data[index].status =
    "Dikembalikan";


  data[index].returnedAt =
    new Date().toISOString();


  saveLoans(data);

  renderLoans();
}


/* =========================================================
   EDIT PEMINJAMAN
   ========================================================= */

function openEditLoan(id) {

  const loan =
    loans().find(
      value => value.id === id
    );


  if (
    !loan ||
    !canLoanEdit(loan)
  ) {

    return;
  }


  $("editLoanId").value =
    loan.id;

  $("loanDepartment").value =
    loan.department;

  $("loanDepartment").disabled =
    !isAdmin();


  populateLoanItems();


  $("loanItem").value =
    loan.itemId;

  $("loanQty").value =
    loan.qty;

  $("loanBorrower").value =
    loan.borrower;

  $("loanDate").value =
    loan.loanDate;

  $("loanDueDate").value =
    loan.dueDate || "";

  $("loanStatus").value =
    loan.status;

  $("loanNote").value =
    loan.note || "";


  $("loanModal").classList.remove(
    "hidden"
  );
}


/* =========================================================
   HAPUS PEMINJAMAN
   ========================================================= */

function deleteLoan(id) {

  const loan =
    loans().find(
      value => value.id === id
    );


  if (
    !loan ||
    !canLoanEdit(loan)
  ) {

    return;
  }


  if (
    confirm(
      "Hapus data peminjaman ini?"
    )
  ) {

    saveLoans(
      loans().filter(
        value => value.id !== id
      )
    );

    renderLoans();
  }
}


/* =========================================================
   MANAJEMEN AKUN ADMIN
   ========================================================= */

function renderAccounts() {

  const body =
    $("accountsBody");


  if (!body) {
    return;
  }


  const data =
    users();


  if (!data.length) {

    body.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-cell"
        >
          Belum ada akun.
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    data.map(user => `

      <tr>

        <td>
          ${esc(user.name)}
        </td>

        <td>
          ${esc(user.username)}
        </td>

        <td>
          ${esc(user.department)}
        </td>

        <td>
          ${esc(user.role)}
        </td>

        <td>
          ${esc(user.status)}
        </td>

        <td>

          ${
            user.status === "pending"

            ?

            `
            <button
              class="small-btn approve-btn"
              onclick="approveUser('${user.id}')"
            >
              Setujui
            </button>
            `

            :

            ""
          }


          ${
            user.status === "approved"

            ?

            `
            <button
              class="small-btn delete-btn"
              onclick="rejectUser('${user.id}')"
            >
              Nonaktifkan
            </button>
            `

            :

            ""
          }

        </td>

      </tr>

    `).join("");
}


/* =========================================================
   SETUJUI AKUN
   ========================================================= */

function approveUser(id) {

  if (!isAdmin()) {
    return;
  }


  const data =
    users();


  const index =
    data.findIndex(
      user => user.id === id
    );


  if (index >= 0) {

    data[index].status =
      "approved";

    saveUsers(data);

    renderAccounts();
  }
}


/* =========================================================
   NONAKTIFKAN AKUN
   ========================================================= */

function rejectUser(id) {

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


  const data =
    users();


  const index =
    data.findIndex(
      user => user.id === id
    );


  if (index >= 0) {

    data[index].status =
      "rejected";

    saveUsers(data);

    renderAccounts();
  }
}
