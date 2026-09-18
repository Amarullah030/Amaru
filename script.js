/* =====================================================
   HISADA INVENTARIS
   Prototype Front-End
===================================================== */


/* =====================================================
   KONFIGURASI
===================================================== */

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


/*
    ADMIN DEMO

    PERINGATAN:
    Jangan gunakan cara ini untuk sistem produksi.
    Password terlihat di source code.
*/

const ADMIN = {
    username: "216416",
    password: "Amarullah060308",
    name: "Admin HISADA",
    role: "admin",
    status: "approved"
};


/* =====================================================
   LOCAL STORAGE
===================================================== */

const USERS_KEY = "hisada_users_v3";
const ITEMS_KEY = "hisada_items_v3";
const SESSION_KEY = "hisada_session_v3";


function getUsers() {

    return JSON.parse(
        localStorage.getItem(USERS_KEY) || "[]"
    );

}


function saveUsers(users) {

    localStorage.setItem(
        USERS_KEY,
        JSON.stringify(users)
    );

}


function getItems() {

    return JSON.parse(
        localStorage.getItem(ITEMS_KEY) || "[]"
    );

}


function saveItems(items) {

    localStorage.setItem(
        ITEMS_KEY,
        JSON.stringify(items)
    );

}


/* =====================================================
   SESSION
===================================================== */

let currentUser = null;


function saveSession(user) {

    localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(user)
    );

}


function loadSession() {

    const session =
        localStorage.getItem(SESSION_KEY);

    if (!session) return null;

    return JSON.parse(session);

}


/* =====================================================
   INITIALIZATION
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        populateDepartmentSelects();

        setupEvents();

        const session = loadSession();

        if (session) {

            currentUser = session;

            startApp();

        } else {

            showAuthPage();

        }

    }
);


/* =====================================================
   POPULATE BAGIAN
===================================================== */

function populateDepartmentSelects() {

    const signDept =
        document.getElementById("signDept");

    const itemDept =
        document.getElementById("itemDepartment");

    const departmentFilter =
        document.getElementById("departmentFilter");


    DEPTS.forEach(dept => {

        const option1 =
            document.createElement("option");

        option1.value = dept;
        option1.textContent = dept;

        signDept.appendChild(option1);


        const option2 =
            document.createElement("option");

        option2.value = dept;
        option2.textContent = dept;

        itemDept.appendChild(option2);


        const option3 =
            document.createElement("option");

        option3.value = dept;
        option3.textContent = dept;

        departmentFilter.appendChild(option3);

    });

}


/* =====================================================
   EVENTS
===================================================== */

function setupEvents() {

    document
        .getElementById("loginForm")
        .addEventListener(
            "submit",
            login
        );


    document
        .getElementById("signupForm")
        .addEventListener(
            "submit",
            signup
        );


    document
        .getElementById("itemForm")
        .addEventListener(
            "submit",
            saveItem
        );

}


/* =====================================================
   AUTH TAB
===================================================== */

function showAuth(type) {

    const loginForm =
        document.getElementById("loginForm");

    const signupForm =
        document.getElementById("signupForm");

    const loginTab =
        document.getElementById("loginTab");

    const signupTab =
        document.getElementById("signupTab");


    if (type === "login") {

        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");

        loginTab.classList.add("active");
        signupTab.classList.remove("active");

    } else {

        loginForm.classList.add("hidden");
        signupForm.classList.remove("hidden");

        loginTab.classList.remove("active");
        signupTab.classList.add("active");

    }

}


/* =====================================================
   LOGIN
===================================================== */

function login(event) {

    event.preventDefault();


    const username =
        document
            .getElementById("loginUser")
            .value
            .trim();


    const password =
        document
            .getElementById("loginPass")
            .value;


    const message =
        document.getElementById(
            "loginMessage"
        );


    /* ADMIN */

    if (
        username === ADMIN.username &&
        password === ADMIN.password
    ) {

        currentUser = {
            ...ADMIN
        };

        saveSession(currentUser);

        startApp();

        return;

    }


    /* USER */

    const users = getUsers();

    const user =
        users.find(
            u =>
                u.username === username
        );


    if (!user) {

        message.textContent =
            "Username atau password salah.";

        return;

    }


    if (user.password !== password) {

        message.textContent =
            "Username atau password salah.";

        return;

    }


    if (user.status !== "approved") {

        message.textContent =
            "Akun masih menunggu persetujuan Admin.";

        return;

    }


    currentUser = user;

    saveSession(currentUser);

    startApp();

}


/* =====================================================
   SIGN UP
===================================================== */

function signup(event) {

    event.preventDefault();


    const name =
        document
            .getElementById("signName")
            .value
            .trim();


    const username =
        document
            .getElementById("signUser")
            .value
            .trim();


    const password =
        document
            .getElementById("signPass")
            .value;


    const department =
        document
            .getElementById("signDept")
            .value;


    const message =
        document.getElementById(
            "signupMessage"
        );


    if (!name || !username || !password || !department) {

        message.textContent =
            "Semua data wajib diisi.";

        return;

    }


    /* ADMIN TIDAK BOLEH DIBUAT */

    if (username === ADMIN.username) {

        message.textContent =
            "Username tersebut tidak dapat digunakan.";

        return;

    }


    const users = getUsers();


    /* CEK USERNAME */

    const exists =
        users.some(
            u =>
                u.username.toLowerCase() ===
                username.toLowerCase()
        );


    if (exists) {

        message.textContent =
            "Username sudah digunakan.";

        return;

    }


    /*
        ROLE:

        Dewan Harian
        -> dewan

        Bagian lain
        -> bagian
    */

    const role =
        department === "Dewan Harian"
            ? "dewan"
            : "bagian";


    const newUser = {

        id: crypto.randomUUID(),

        name,

        username,

        password,

        department,

        role,

        status: "pending",

        createdAt:
            new Date().toISOString()

    };


    users.push(newUser);

    saveUsers(users);


    message.textContent =
        "Pendaftaran berhasil. Tunggu persetujuan Admin.";


    document
        .getElementById("signupForm")
        .reset();

}


/* =====================================================
   START APP
===================================================== */

function startApp() {

    document
        .getElementById("authPage")
        .classList.add("hidden");


    document
        .getElementById("appPage")
        .classList.remove("hidden");


    updateUserUI();

    setupPermissions();

    showPage("dashboard");

}


/* =====================================================
   SHOW AUTH
===================================================== */

function showAuthPage() {

    document
        .getElementById("authPage")
        .classList.remove("hidden");


    document
        .getElementById("appPage")
        .classList.add("hidden");

}


/* =====================================================
   LOGOUT
===================================================== */

function logout() {

    currentUser = null;

    localStorage.removeItem(
        SESSION_KEY
    );

    showAuthPage();

}


/* =====================================================
   USER UI
===================================================== */

function updateUserUI() {

    document
        .getElementById("sidebarUserName")
        .textContent =
        currentUser.name;


    document
        .getElementById("topbarUser")
        .textContent =
        currentUser.name;


    document
        .getElementById("welcomeName")
        .textContent =
        currentUser.name;


    let roleText = "";


    if (currentUser.role === "admin") {

        roleText = "Administrator";

    } else if (currentUser.role === "dewan") {

        roleText =
            "Dewan Harian";

    } else {

        roleText =
            currentUser.department;

    }


    document
        .getElementById("sidebarUserRole")
        .textContent =
        roleText;

}


/* =====================================================
   PERMISSION
===================================================== */

function setupPermissions() {

    const adminButtons =
        document.querySelectorAll(
            ".admin-only"
        );


    /*
        Hanya Admin yang melihat
        menu Akun.
    */

    adminButtons.forEach(
        button => {

            if (
                currentUser.role === "admin"
            ) {

                button.classList.remove(
                    "hidden"
                );

            } else {

                button.classList.add(
                    "hidden"
                );

            }

        }
    );


    setupDepartmentAccess();

}


/* =====================================================
   DEPARTMENT ACCESS
===================================================== */

function setupDepartmentAccess() {

    const itemDepartment =
        document.getElementById(
            "itemDepartment"
        );


    /*
        Admin:
        bebas memilih bagian.
    */

    if (currentUser.role === "admin") {

        itemDepartment.disabled = false;

        return;

    }


    /*
        Dewan:
        boleh melihat seluruh data,
        tetapi ketika menambah barang,
        tidak boleh memasukkan barang
        ke bagian lain.
    */

    if (currentUser.role === "dewan") {

        itemDepartment.disabled = true;

        return;

    }


    /*
        User bagian:
        hanya bagian sendiri.
    */

    itemDepartment.value =
        currentUser.department;

    itemDepartment.disabled = true;

}


/* =====================================================
   PAGE NAVIGATION
===================================================== */

function showPage(page) {

    const pages = [
        "dashboard",
        "inventory",
        "accounts"
    ];


    pages.forEach(
        name => {

            const element =
                document.getElementById(
                    name + "Page"
                );

            if (!element) return;


            if (name === page) {

                element.classList.remove(
                    "hidden"
                );

            } else {

                element.classList.add(
                    "hidden"
                );

            }

        }
    );


    document
        .querySelectorAll(".nav-item")
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.page === page
                );

            }
        );


    const titles = {

        dashboard: [
            "Dashboard",
            "Ringkasan inventaris HISADA"
        ],

        inventory: [
            "Inventaris",
            "Kelola data barang inventaris"
        ],

        accounts: [
            "Akun",
            "Manajemen akun pengguna"
        ]

    };


    document
        .getElementById("pageTitle")
        .textContent =
        titles[page][0];


    document
        .getElementById("pageSubtitle")
        .textContent =
        titles[page][1];


    if (page === "dashboard") {

        renderDashboard();

    }


    if (page === "inventory") {

        renderInventory();

    }


    if (page === "accounts") {

        if (
            currentUser.role !== "admin"
        ) {

            showPage("dashboard");

            return;

        }

        renderAccounts();

    }

}


/* =====================================================
   GET VISIBLE ITEMS
===================================================== */

function getVisibleItems() {

    const items = getItems();


    /*
        ADMIN:
        lihat semua.
    */

    if (
        currentUser.role === "admin"
    ) {

        return items;

    }


    /*
        DEWAN:
        lihat semua.
    */

    if (
        currentUser.role === "dewan"
    ) {

        return items;

    }


    /*
        BAGIAN:
        hanya bagian sendiri.
    */

    return items.filter(
        item =>
            item.department ===
            currentUser.department
    );

}


/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {

    const items =
        getVisibleItems();


    let good = 0;
    let fair = 0;
    let bad = 0;
    let lost = 0;
    let total = 0;


    items.forEach(item => {

        const quantity =
            Number(item.quantity) || 0;


        total += quantity;


        if (item.condition === "Baik") {

            good += quantity;

        } else if (
            item.condition === "Kurang Baik"
        ) {

            fair += quantity;

        } else if (
            item.condition === "Rusak Berat"
        ) {

            bad += quantity;

        } else if (
            item.condition === "Hilang"
        ) {

            lost += quantity;

        }

    });


    document
        .getElementById("statGood")
        .textContent =
        good;


    document
        .getElementById("statFair")
        .textContent =
        fair;


    document
        .getElementById("statBad")
        .textContent =
        bad;


    document
        .getElementById("statLost")
        .textContent =
        lost;


    document
        .getElementById("statTotal")
        .textContent =
        total;


    renderDepartmentSummary();

}


/* =====================================================
   DEPARTMENT SUMMARY
===================================================== */

function renderDepartmentSummary() {

    const container =
        document.getElementById(
            "departmentSummary"
        );


    container.innerHTML = "";


    const items =
        getVisibleItems();


    DEPTS.forEach(dept => {

        const deptItems =
            items.filter(
                item =>
                    item.department === dept
            );


        const total =
            deptItems.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    Number(item.quantity || 0),
                0
            );


        /*
            Untuk user bagian,
            cukup tampilkan bagian sendiri.
        */

        if (
            currentUser.role === "bagian" &&
            dept !== currentUser.department
        ) {

            return;

        }


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "department-card";


        card.innerHTML = `
            <strong>${escapeHTML(dept)}</strong>
            <span>${total} unit barang</span>
        `;


        container.appendChild(card);

    });

}


/* =====================================================
   INVENTORY
===================================================== */

function renderInventory() {

    const body =
        document.getElementById(
            "inventoryBody"
        );


    const search =
        document
            .getElementById("searchInput")
            .value
            .toLowerCase()
            .trim();


    const condition =
        document
            .getElementById("conditionFilter")
            .value;


    const department =
        document
            .getElementById("departmentFilter")
            .value;


    let items =
        getVisibleItems();


    /* SEARCH */

    if (search) {

        items =
            items.filter(
                item =>
                    item.name
                        .toLowerCase()
                        .includes(search)
            );

    }


    /* CONDITION */

    if (condition !== "all") {

        items =
            items.filter(
                item =>
                    item.condition === condition
            );

    }


    /*
        Department filter:
        hanya admin/dewan.
    */

    if (
        department !== "all" &&
        (
            currentUser.role === "admin" ||
            currentUser.role === "dewan"
        )
    ) {

        items =
            items.filter(
                item =>
                    item.department === department
            );

    }


    body.innerHTML = "";


    if (items.length === 0) {

        body.innerHTML = `
            <tr>
                <td colspan="7"
                    style="text-align:center;padding:30px;">
                    Belum ada data inventaris.
                </td>
            </tr>
        `;

        return;

    }


    items.forEach(item => {

        const row =
            document.createElement("tr");


        const badgeClass =
            getConditionBadge(item.condition);


        row.innerHTML = `

            <td>
                <strong>
                    ${escapeHTML(item.number)}
                </strong>
            </td>

            <td>
                ${escapeHTML(item.department)}
            </td>

            <td>
                ${escapeHTML(item.name)}
            </td>

            <td>
                ${Number(item.quantity)}
            </td>

            <td>
                <span class="badge ${badgeClass}">
                    ${escapeHTML(item.condition)}
                </span>
            </td>

            <td>
                ${escapeHTML(
                    item.description || "-"
                )}
            </td>

            <td>

                <div class="action-group">

                    ${canEditItem(item)
                        ? `
                            <button
                                class="small-btn edit-btn"
                                onclick="openEditItem('${item.id}')">
                                Edit
                            </button>
                        `
                        : ""
                    }

                    ${canEditItem(item)
                        ? `
                            <button
                                class="small-btn delete-btn"
                                onclick="deleteItem('${item.id}')">
                                Hapus
                            </button>
                        `
                        : ""
                    }

                </div>

            </td>
        `;


        body.appendChild(row);

    });

}


/* =====================================================
   CAN EDIT ITEM
===================================================== */

function canEditItem(item) {

    if (
        currentUser.role === "admin"
    ) {

        return true;

    }


    /*
        Dewan hanya melihat.
    */

    if (
        currentUser.role === "dewan"
    ) {

        return false;

    }


    return (
        item.department ===
        currentUser.department
    );

}


/* =====================================================
   BADGE
===================================================== */

function getConditionBadge(condition) {

    const map = {

        "Baik": "badge-good",

        "Kurang Baik": "badge-fair",

        "Rusak Berat": "badge-bad",

        "Hilang": "badge-lost"

    };


    return (
        map[condition] ||
        ""
    );

}


/* =====================================================
   OPEN ADD
===================================================== */

function openAddItem() {

    /*
        Dewan tidak boleh menambah
        inventaris karena fungsinya
        sebagai viewer lintas bagian.
    */

    if (
        currentUser.role === "dewan"
    ) {

        alert(
            "Akun Dewan Harian hanya dapat melihat inventaris seluruh bagian."
        );

        return;

    }


    document
        .getElementById("itemForm")
        .reset();


    document
        .getElementById("editItemId")
        .value = "";


    document
        .getElementById("modalTitle")
        .textContent =
        "Tambah Barang";


    const dept =
        document.getElementById(
            "itemDepartment"
        );


    if (
        currentUser.role === "admin"
    ) {

        dept.disabled = false;

        dept.value =
            DEPTS[0];

    } else {

        dept.value =
            currentUser.department;

        dept.disabled = true;

    }


    document
        .getElementById("itemModal")
        .classList.remove(
            "hidden"
        );

}


/* =====================================================
   OPEN EDIT
===================================================== */

function openEditItem(id) {

    const items =
        getItems();


    const item =
        items.find(
            x => x.id === id
        );


    if (!item) return;


    if (!canEditItem(item)) {

        alert(
            "Anda tidak memiliki akses untuk mengedit barang ini."
        );

        return;

    }


    document
        .getElementById("editItemId")
        .value =
        item.id;


    document
        .getElementById("itemDepartment")
        .value =
        item.department;


    document
        .getElementById("itemName")
        .value =
        item.name;


    document
        .getElementById("itemQuantity")
        .value =
        item.quantity;


    document
        .getElementById("itemCondition")
        .value =
        item.condition;


    document
        .getElementById("itemDescription")
        .value =
        item.description || "";


    document
        .getElementById("modalTitle")
        .textContent =
        "Edit Barang";


    if (
        currentUser.role === "admin"
    ) {

        document
            .getElementById("itemDepartment")
            .disabled = false;

    } else {

        document
            .getElementById("itemDepartment")
            .disabled = true;

    }


    document
        .getElementById("itemModal")
        .classList.remove(
            "hidden"
        );

}


/* =====================================================
   CLOSE MODAL
===================================================== */

function closeItemModal() {

    document
        .getElementById("itemModal")
        .classList.add(
            "hidden"
        );

}


/* =====================================================
   SAVE ITEM
===================================================== */

function saveItem(event) {

    event.preventDefault();


    const id =
        document
            .getElementById("editItemId")
            .value;


    let department =
        document
            .getElementById("itemDepartment")
            .value;


    /*
        Security logic prototype:

        User bagian tidak boleh
        mengubah bagian barang.
    */

    if (
        currentUser.role === "bagian"
    ) {

        department =
            currentUser.department;

    }


    const name =
        document
            .getElementById("itemName")
            .value
            .trim();


    const quantity =
        Number(
            document
                .getElementById("itemQuantity")
                .value
        );


    const condition =
        document
            .getElementById("itemCondition")
            .value;


    const description =
        document
            .getElementById("itemDescription")
            .value
            .trim();


    if (
        !department ||
        !name ||
        quantity <= 0 ||
        !condition
    ) {

        alert(
            "Data belum lengkap."
        );

        return;

    }


    let items =
        getItems();


    /* =========================================
       EDIT
    ========================================= */

    if (id) {

        const index =
            items.findIndex(
                item =>
                    item.id === id
            );


        if (index === -1) return;


        if (
            !canEditItem(
                items[index]
            )
        ) {

            alert(
                "Anda tidak memiliki akses."
            );

            return;

        }


        items[index] = {

            ...items[index],

            department,

            name,

            quantity,

            condition,

            description,

            updatedAt:
                new Date().toISOString()

        };

    }


    /* =========================================
       TAMBAH
    ========================================= */

    else {

        const newItem = {

            id: crypto.randomUUID(),

            department,

            name,

            quantity,

            condition,

            description,

            createdAt:
                new Date().toISOString()

        };


        newItem.number =
            generateItemNumber(
                department
            );


        items.push(newItem);

    }


    saveItems(items);

    closeItemModal();

    renderInventory();

    renderDashboard();

}


/* =====================================================
   GENERATE ITEM NUMBER
===================================================== */

function generateItemNumber(department) {

    const prefix =
        getDepartmentPrefix(
            department
        );


    const items =
        getItems();


    const departmentItems =
        items.filter(
            item =>
                item.department === department
        );


    let maxNumber = 0;


    departmentItems.forEach(
        item => {

            const match =
                item.number?.match(
                    /(\d+)$/
                );


            if (match) {

                const number =
                    Number(
                        match[1]
                    );


                if (
                    number > maxNumber
                ) {

                    maxNumber = number;

                }

            }

        }
    );


    const next =
        maxNumber + 1;


    return (
        prefix +
        "-" +
        String(next).padStart(3, "0")
    );

}


/* =====================================================
   PREFIX
===================================================== */

function getDepartmentPrefix(department) {

    const prefixes = {

        "Logistik": "LOG",

        "Bahasa": "BHS",

        "Kesehatan": "KES",

        "Ta'mir Masjid": "TMR",

        "Keamanan": "KAM",

        "Pramuka": "PRA",

        "Olahraga": "OLA",

        "Dewan Harian": "DWH",

        "Dapur": "DAP",

        "Kesenian": "KSN"

    };


    return (
        prefixes[department] ||
        "HSD"
    );

}


/* =====================================================
   DELETE ITEM
===================================================== */

function deleteItem(id) {

    const items =
        getItems();


    const item =
        items.find(
            x => x.id === id
        );


    if (!item) return;


    if (
        !canEditItem(item)
    ) {

        alert(
            "Anda tidak memiliki akses untuk menghapus barang ini."
        );

        return;

    }


    const confirmDelete =
        confirm(
            `Hapus barang "${item.name}"?`
        );


    if (!confirmDelete) return;


    const newItems =
        items.filter(
            x => x.id !== id
        );


    saveItems(newItems);


    renderInventory();

    renderDashboard();

}


/* =====================================================
   ACCOUNT MANAGEMENT
===================================================== */

function renderAccounts() {

    if (
        currentUser.role !== "admin"
    ) {

        return;

    }


    const body =
        document.getElementById(
            "accountsBody"
        );


    const users =
        getUsers();


    body.innerHTML = "";


    if (users.length === 0) {

        body.innerHTML = `
            <tr>
                <td colspan="6"
                    style="text-align:center;padding:30px;">
                    Belum ada akun yang mendaftar.
                </td>
            </tr>
        `;

        return;

    }


    users.forEach(user => {

        const row =
            document.createElement(
                "tr"
            );


        const statusClass =
            user.status === "approved"
                ? "badge-approved"
                : "badge-pending";


        row.innerHTML = `

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
                ${getRoleName(user.role)}
            </td>

            <td>
                <span class="badge ${statusClass}">
                    ${escapeHTML(user.status)}
                </span>
            </td>

            <td>

                <div class="action-group">

                    ${
                        user.status === "pending"
                        ?
                        `
                            <button
                                class="small-btn approve-btn"
                                onclick="approveUser('${user.id}')">
                                Setujui
                            </button>
                        `
                        :
                        ""
                    }


                    <button
                        class="small-btn delete-btn"
                        onclick="deleteUser('${user.id}')">
                        Hapus
                    </button>

                </div>

            </td>

        `;


        body.appendChild(row);

    });

}


/* =====================================================
   ROLE NAME
===================================================== */

function getRoleName(role) {

    const roles = {

        admin:
            "Admin",

        dewan:
            "Dewan Harian",

        bagian:
            "Bagian"

    };


    return (
        roles[role] ||
        role
    );

}


/* =====================================================
   APPROVE USER
===================================================== */

function approveUser(id) {

    if (
        currentUser.role !== "admin"
    ) {

        return;

    }


    const users =
        getUsers();


    const user =
        users.find(
            u => u.id === id
        );


    if (!user) return;


    user.status =
        "approved";


    saveUsers(users);


    renderAccounts();

}


/* =====================================================
   DELETE USER
===================================================== */

function deleteUser(id) {

    if (
        currentUser.role !== "admin"
    ) {

        return;

    }


    const users =
        getUsers();


    const user =
        users.find(
            u => u.id === id
        );


    if (!user) return;


    const confirmed =
        confirm(
            `Hapus akun ${user.username}?`
        );


    if (!confirmed) return;


    const newUsers =
        users.filter(
            u => u.id !== id
        );


    saveUsers(newUsers);


    renderAccounts();

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#039;");

}
