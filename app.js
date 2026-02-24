const STORAGE_KEYS = {
  users: "ims-users",
  cameras: "ims-cameras",
  transactions: "ims-transactions",
  session: "ims-session"
};

const seedUsers = [
  { username: "admin", password: "admin123", role: "Admin", fullName: "Lab Administrator" },
  { username: "staff", password: "staff123", role: "Staff", fullName: "Lab Staff" }
];

const seedCameras = [
  { id: crypto.randomUUID(), name: "Canon EOS R7", barcode: "CAM-1001", status: "Available", archived: false },
  { id: crypto.randomUUID(), name: "Sony A7 IV", barcode: "CAM-1002", status: "Available", archived: false },
  { id: crypto.randomUUID(), name: "Nikon Z6 II", barcode: "CAM-1003", status: "Under Maintenance", archived: false }
];

const state = {
  users: loadOrSeed(STORAGE_KEYS.users, seedUsers),
  cameras: loadOrSeed(STORAGE_KEYS.cameras, seedCameras),
  transactions: loadOrSeed(STORAGE_KEYS.transactions, []),
  session: JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null")
};

const elements = {
  loginView: document.getElementById("login-view"),
  dashboardView: document.getElementById("dashboard-view"),
  loginForm: document.getElementById("login-form"),
  loginError: document.getElementById("login-error"),
  userInfo: document.getElementById("user-info"),
  logoutBtn: document.getElementById("logout-btn"),
  navButtons: document.querySelectorAll(".nav-btn"),
  sectionTitle: document.getElementById("section-title"),
  overdueBanner: document.getElementById("overdue-banner"),
  statAvailable: document.getElementById("stat-available"),
  statBorrowed: document.getElementById("stat-borrowed"),
  statOverdue: document.getElementById("stat-overdue"),
  recentActivity: document.getElementById("recent-activity"),
  cameraForm: document.getElementById("camera-form"),
  cameraTable: document.getElementById("camera-table"),
  cameraEditId: document.getElementById("camera-edit-id"),
  cameraName: document.getElementById("camera-name"),
  cameraBarcode: document.getElementById("camera-barcode"),
  cameraStatus: document.getElementById("camera-status"),
  cameraSubmit: document.getElementById("camera-submit"),
  cameraCancel: document.getElementById("camera-cancel"),
  adminOnlyNote: document.getElementById("admin-only-note"),
  borrowForm: document.getElementById("borrow-form"),
  borrowCamera: document.getElementById("borrow-camera"),
  returnForm: document.getElementById("return-form"),
  returnTransaction: document.getElementById("return-transaction"),
  transactionTable: document.getElementById("transaction-table"),
  historyForm: document.getElementById("history-form"),
  historyId: document.getElementById("history-id"),
  historyTable: document.getElementById("history-table"),
  downloadExcel: document.getElementById("download-excel"),
  downloadPdf: document.getElementById("download-pdf")
};

function loadOrSeed(key, fallback) {
  const existing = localStorage.getItem(key);
  if (existing) return JSON.parse(existing);
  localStorage.setItem(key, JSON.stringify(fallback));
  return JSON.parse(JSON.stringify(fallback));
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.cameras, JSON.stringify(state.cameras));
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(state.session));
}

function isOverdue(transaction) {
  return !transaction.actualReturnAt && new Date(transaction.expectedReturnAt) < new Date();
}

function activeTransactions() {
  return state.transactions.filter((t) => !t.actualReturnAt);
}

function cameraById(id) {
  return state.cameras.find((camera) => camera.id === id);
}

function getTransactionStatus(transaction) {
  if (transaction.actualReturnAt) return "Returned";
  return isOverdue(transaction) ? "Overdue" : "Borrowed";
}

function switchView(viewId) {
  document.querySelectorAll(".panel-section").forEach((section) => {
    section.classList.toggle("hidden", section.id !== viewId);
  });
  elements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.target === viewId);
  });
  elements.sectionTitle.textContent = viewId.charAt(0).toUpperCase() + viewId.slice(1);
}

function renderDashboard() {
  const available = state.cameras.filter((c) => !c.archived && c.status === "Available").length;
  const borrowed = activeTransactions().length;
  const overdue = activeTransactions().filter(isOverdue).length;

  elements.statAvailable.textContent = String(available);
  elements.statBorrowed.textContent = String(borrowed);
  elements.statOverdue.textContent = String(overdue);

  if (overdue > 0) {
    elements.overdueBanner.classList.remove("hidden");
    elements.overdueBanner.textContent = `${overdue} overdue item(s) require attention`;
  } else {
    elements.overdueBanner.classList.add("hidden");
    elements.overdueBanner.textContent = "";
  }

  const recent = [...state.transactions]
    .sort((a, b) => new Date(b.borrowedAt) - new Date(a.borrowedAt))
    .slice(0, 6);

  elements.recentActivity.innerHTML = recent
    .map((t) => {
      const camera = cameraById(t.cameraId);
      return `<tr>
        <td>${t.borrowerName}</td>
        <td>${camera ? camera.name : "Unknown"}</td>
        <td>${new Date(t.borrowedAt).toLocaleString()}</td>
        <td><span class="badge ${getTransactionStatus(t) === "Overdue" ? "danger" : "success"}">${getTransactionStatus(t)}</span></td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="4">No transactions yet.</td></tr>`;
}

function renderCameras() {
  const canManage = state.session?.role === "Admin";
  elements.cameraForm.querySelectorAll("input,select,button").forEach((node) => {
    node.disabled = !canManage;
  });
  elements.adminOnlyNote.classList.toggle("hidden", canManage);

  elements.cameraTable.innerHTML = state.cameras
    .map((camera) => `<tr>
      <td>${camera.name}</td>
      <td>${camera.barcode}</td>
      <td>${camera.status}</td>
      <td>${camera.archived ? "Yes" : "No"}</td>
      <td class="actions-row">
        <button class="btn" data-action="edit" data-id="${camera.id}" ${!canManage ? "disabled" : ""}>Edit</button>
        <button class="btn" data-action="archive" data-id="${camera.id}" ${!canManage ? "disabled" : ""}>${camera.archived ? "Unarchive" : "Archive"}</button>
      </td>
    </tr>`)
    .join("");
}

function renderTransactionInputs() {
  const availableCameras = state.cameras.filter((camera) => !camera.archived && camera.status === "Available");
  elements.borrowCamera.innerHTML = availableCameras
    .map((camera) => `<option value="${camera.id}">${camera.name} (${camera.barcode})</option>`)
    .join("");

  const active = activeTransactions();
  elements.returnTransaction.innerHTML = active
    .map((t) => {
      const camera = cameraById(t.cameraId);
      return `<option value="${t.id}">${t.borrowerName} - ${camera?.name || "Unknown"}</option>`;
    })
    .join("");
}

function renderTransactions() {
  elements.transactionTable.innerHTML = [...state.transactions]
    .sort((a, b) => new Date(b.borrowedAt) - new Date(a.borrowedAt))
    .map((t) => {
      const camera = cameraById(t.cameraId);
      const status = getTransactionStatus(t);
      const badgeClass = status === "Overdue" ? "danger" : status === "Borrowed" ? "warning" : "success";
      return `<tr>
        <td>${t.borrowerName}</td>
        <td>${t.borrowerCode}</td>
        <td>${t.department}</td>
        <td>${camera ? camera.name : "Unknown"}</td>
        <td>${new Date(t.borrowedAt).toLocaleString()}</td>
        <td>${new Date(t.expectedReturnAt).toLocaleString()}</td>
        <td>${t.actualReturnAt ? new Date(t.actualReturnAt).toLocaleString() : "-"}</td>
        <td>${t.approvedBy}</td>
        <td><span class="badge ${badgeClass}">${status}</span></td>
      </tr>`;
    })
    .join("");
}

function renderHistory(byId = "") {
  const rows = state.transactions
    .filter((t) => (byId ? t.borrowerCode.toLowerCase() === byId.toLowerCase() : false))
    .map((t) => {
      const camera = cameraById(t.cameraId);
      return `<tr>
        <td>${t.borrowerName}</td>
        <td>${camera ? camera.name : "Unknown"}</td>
        <td>${new Date(t.borrowedAt).toLocaleString()}</td>
        <td>${t.actualReturnAt ? new Date(t.actualReturnAt).toLocaleString() : "-"}</td>
        <td>${getTransactionStatus(t)}</td>
      </tr>`;
    })
    .join("");

  elements.historyTable.innerHTML = rows || `<tr><td colspan="5">No history found for this ID.</td></tr>`;
}

function rerenderAll() {
  saveState();
  renderDashboard();
  renderCameras();
  renderTransactionInputs();
  renderTransactions();
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const user = state.users.find((u) => u.username === username && u.password === password);

  if (!user) {
    elements.loginError.textContent = "Invalid username or password.";
    return;
  }

  state.session = { username: user.username, role: user.role, fullName: user.fullName };
  elements.loginError.textContent = "";
  saveState();
  bootstrapApp();
}

function handleLogout() {
  state.session = null;
  saveState();
  elements.dashboardView.classList.add("hidden");
  elements.loginView.classList.remove("hidden");
}

function setupListeners() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutBtn.addEventListener("click", handleLogout);

  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.target));
  });

  elements.cameraForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.session?.role !== "Admin") return;

    const existingBarcode = state.cameras.find(
      (camera) => camera.barcode.toLowerCase() === elements.cameraBarcode.value.trim().toLowerCase() && camera.id !== elements.cameraEditId.value
    );

    if (existingBarcode) {
      alert("Barcode already exists.");
      return;
    }

    const payload = {
      name: elements.cameraName.value.trim(),
      barcode: elements.cameraBarcode.value.trim(),
      status: elements.cameraStatus.value,
      archived: false
    };

    if (elements.cameraEditId.value) {
      const camera = cameraById(elements.cameraEditId.value);
      Object.assign(camera, payload);
    } else {
      state.cameras.push({ id: crypto.randomUUID(), ...payload });
    }

    elements.cameraForm.reset();
    elements.cameraEditId.value = "";
    elements.cameraSubmit.textContent = "Add Camera";
    rerenderAll();
  });

  elements.cameraCancel.addEventListener("click", () => {
    elements.cameraForm.reset();
    elements.cameraEditId.value = "";
    elements.cameraSubmit.textContent = "Add Camera";
  });

  elements.cameraTable.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || state.session?.role !== "Admin") return;

    const cameraId = target.dataset.id;
    const action = target.dataset.action;
    const camera = cameraById(cameraId);
    if (!camera) return;

    if (action === "edit") {
      elements.cameraEditId.value = camera.id;
      elements.cameraName.value = camera.name;
      elements.cameraBarcode.value = camera.barcode;
      elements.cameraStatus.value = camera.status;
      elements.cameraSubmit.textContent = "Update Camera";
    }

    if (action === "archive") {
      const hasActiveBorrow = activeTransactions().some((t) => t.cameraId === camera.id);
      if (hasActiveBorrow && !camera.archived) {
        alert("Cannot archive: camera currently borrowed.");
        return;
      }
      camera.archived = !camera.archived;
      rerenderAll();
    }
  });

  elements.borrowForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const cameraId = elements.borrowCamera.value;
    const camera = cameraById(cameraId);
    if (!camera || camera.archived || camera.status !== "Available") {
      alert("Selected camera is unavailable.");
      return;
    }

    const alreadyBorrowed = activeTransactions().some((t) => t.cameraId === cameraId);
    if (alreadyBorrowed) {
      alert("This camera is already borrowed.");
      return;
    }

    const transaction = {
      id: crypto.randomUUID(),
      borrowerName: document.getElementById("borrower-name").value.trim(),
      borrowerCode: document.getElementById("borrower-id").value.trim(),
      department: document.getElementById("borrower-dept").value.trim(),
      cameraId,
      borrowedAt: new Date().toISOString(),
      expectedReturnAt: new Date(document.getElementById("expected-return").value).toISOString(),
      actualReturnAt: null,
      approvedBy: document.getElementById("approved-by").value.trim()
    };

    state.transactions.push(transaction);
    camera.status = "Borrowed";
    elements.borrowForm.reset();
    rerenderAll();
  });

  elements.returnForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const transaction = state.transactions.find((t) => t.id === elements.returnTransaction.value);
    if (!transaction) return;

    transaction.actualReturnAt = new Date().toISOString();
    const camera = cameraById(transaction.cameraId);
    if (camera && !camera.archived) camera.status = "Available";
    rerenderAll();
  });

  elements.historyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderHistory(elements.historyId.value.trim());
  });

  elements.downloadExcel.addEventListener("click", () => {
    const headers = [
      "Borrower Name",
      "Borrower ID",
      "Department",
      "Camera",
      "Borrowed At",
      "Expected Return",
      "Actual Return",
      "Approved By",
      "Status"
    ];
    const rows = state.transactions.map((t) => [
      t.borrowerName,
      t.borrowerCode,
      t.department,
      cameraById(t.cameraId)?.name || "Unknown",
      new Date(t.borrowedAt).toLocaleString(),
      new Date(t.expectedReturnAt).toLocaleString(),
      t.actualReturnAt ? new Date(t.actualReturnAt).toLocaleString() : "",
      t.approvedBy,
      getTransactionStatus(t)
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `camera-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  });

  elements.downloadPdf.addEventListener("click", () => {
    const rows = state.transactions
      .map((t) => `<tr>
        <td>${t.borrowerName}</td>
        <td>${t.borrowerCode}</td>
        <td>${cameraById(t.cameraId)?.name || "Unknown"}</td>
        <td>${new Date(t.borrowedAt).toLocaleString()}</td>
        <td>${t.actualReturnAt ? new Date(t.actualReturnAt).toLocaleString() : "Pending"}</td>
        <td>${getTransactionStatus(t)}</td>
      </tr>`)
      .join("");

    const reportWindow = window.open("", "_blank");
    reportWindow.document.write(`
      <html>
        <head><title>Camera Inventory Report</title></head>
        <body>
          <h2>Camera Borrowing Report</h2>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <table border="1" cellspacing="0" cellpadding="5">
            <thead><tr><th>Borrower</th><th>ID</th><th>Camera</th><th>Borrowed</th><th>Returned</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.print();
  });
}

function bootstrapApp() {
  const isLoggedIn = Boolean(state.session);
  elements.loginView.classList.toggle("hidden", isLoggedIn);
  elements.dashboardView.classList.toggle("hidden", !isLoggedIn);

  if (!isLoggedIn) return;

  elements.userInfo.textContent = `${state.session.fullName} (${state.session.role})`;
  switchView("dashboard");
  rerenderAll();
}

setupListeners();
bootstrapApp();
setInterval(() => {
  if (state.session) rerenderAll();
}, 30000);
