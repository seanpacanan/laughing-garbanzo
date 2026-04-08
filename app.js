const state = {
  currentUser: null,
  cameras: JSON.parse(localStorage.getItem('cams') || '[]'),
  transactions: JSON.parse(localStorage.getItem('txs') || '[]')
};

const users = [
  { username: 'admin', password: 'admin123', role: 'Admin', name: 'System Admin' },
  { username: 'staff', password: 'staff123', role: 'Staff', name: 'Lab Staff' }
];

const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString() : '-';

function persist() {
  localStorage.setItem('cams', JSON.stringify(state.cameras));
  localStorage.setItem('txs', JSON.stringify(state.transactions));
}

function seedData() {
  if (!state.cameras.length) {
    state.cameras = [
      { id: crypto.randomUUID(), name: 'Canon EOS R6', barcode: 'CAM-0001', serial: 'SN-CAN-101', status: 'Available', archived: false },
      { id: crypto.randomUUID(), name: 'Sony A7 IV', barcode: 'CAM-0002', serial: 'SN-SON-202', status: 'Under Maintenance', archived: false }
    ];
    persist();
  }
}

function navTo(sectionId) {
  document.querySelectorAll('.section-view').forEach((el) => el.classList.add('hidden'));
  $(sectionId).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.section === sectionId));
}

function updateDashboard() {
  const activeTx = state.transactions.filter((t) => !t.returnedAt);
  activeTx.forEach((tx) => {
    if (new Date(tx.expectedReturn) < new Date()) tx.status = 'Overdue';
  });

  const total = state.cameras.filter((c) => !c.archived).length;
  const available = state.cameras.filter((c) => !c.archived && c.status === 'Available').length;
  const borrowed = activeTx.length;
  const overdue = activeTx.filter((t) => t.status === 'Overdue').length;

  $('totalCameras').textContent = total;
  $('availableCameras').textContent = available;
  $('borrowedCameras').textContent = borrowed;
  $('overdueCameras').textContent = overdue;

  const list = $('overdueList');
  list.innerHTML = '';
  const overdueItems = activeTx.filter((t) => t.status === 'Overdue');
  if (!overdueItems.length) list.innerHTML = '<li>No overdue borrowings.</li>';
  overdueItems.forEach((t) => {
    const li = document.createElement('li');
    li.textContent = `${t.borrowerName} (${t.borrowerId}) - ${t.cameraName} overdue since ${fmtDate(t.expectedReturn)}`;
    list.appendChild(li);
  });
  $('overdueNotice').textContent = overdue ? `⚠ ${overdue} overdue item(s) need attention.` : 'All borrowings are within return schedule.';
  persist();
}

function renderCameras() {
  const tbody = $('cameraTable');
  tbody.innerHTML = '';
  state.cameras.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.barcode}</td>
      <td>${c.serial}</td>
      <td><span class="badge ${c.status}">${c.status}</span></td>
      <td>${c.archived ? 'Yes' : 'No'}</td>
      <td>
        <button data-edit="${c.id}" class="secondary">Edit</button>
        <button data-archive="${c.id}" class="danger">${c.archived ? 'Restore' : 'Archive'}</button>
      </td>`;
    tbody.appendChild(tr);
  });

  $('borrowCamera').innerHTML = '<option value="">Select Camera</option>' + state.cameras
    .filter((c) => !c.archived && c.status === 'Available')
    .map((c) => `<option value="${c.id}">${c.name} (${c.barcode})</option>`)
    .join('');
}

function renderTransactions() {
  const activeBody = $('activeBorrowTable');
  activeBody.innerHTML = '';
  state.transactions.filter((t) => !t.returnedAt).forEach((t) => {
    const status = new Date(t.expectedReturn) < new Date() ? 'Overdue' : 'Borrowed';
    t.status = status;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.borrowerName}</td>
      <td>${t.borrowerId}</td>
      <td>${t.department}</td>
      <td>${t.cameraName}</td>
      <td>${fmtDate(t.borrowedAt)}</td>
      <td>${fmtDate(t.expectedReturn)}</td>
      <td>${t.approvedBy}</td>
      <td><span class="badge ${status}">${status}</span></td>
      <td><button data-return="${t.id}">Return</button></td>`;
    activeBody.appendChild(tr);
  });

  const filter = $('historyFilter').value.trim().toLowerCase();
  const historyBody = $('historyTable');
  historyBody.innerHTML = '';
  state.transactions
    .filter((t) => !filter || t.borrowerId.toLowerCase().includes(filter))
    .slice().reverse()
    .forEach((t) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.borrowerName}</td><td>${t.borrowerId}</td><td>${t.department}</td><td>${t.cameraName}</td><td>${fmtDate(t.borrowedAt)}</td><td>${fmtDate(t.expectedReturn)}</td><td>${fmtDate(t.returnedAt)}</td><td>${t.approvedBy}</td><td>${t.returnedAt ? 'Returned' : t.status}</td>`;
      historyBody.appendChild(tr);
    });
}

function refreshAll() {
  renderCameras();
  renderTransactions();
  updateDashboard();
}

$('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = $('username').value.trim();
  const password = $('password').value.trim();
  const found = users.find((u) => u.username === username && u.password === password);
  if (!found) return $('loginError').textContent = 'Invalid login credentials.';

  state.currentUser = found;
  $('sessionInfo').textContent = `${found.name} (${found.role})`;
  $('loginView').classList.add('hidden');
  $('dashboardView').classList.remove('hidden');

  // Staff cannot archive/edit maintenance status
  if (found.role === 'Staff') {
    $('cameraStatus').closest('label').classList.add('hidden');
  }
  refreshAll();
});

$('logoutBtn').addEventListener('click', () => location.reload());

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => navTo(btn.dataset.section));
});

$('cameraForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('cameraId').value;
  const payload = {
    id: id || crypto.randomUUID(),
    name: $('cameraName').value.trim(),
    barcode: $('cameraBarcode').value.trim(),
    serial: $('cameraSerial').value.trim(),
    status: $('cameraStatus').value,
    archived: false
  };

  if (state.cameras.some((c) => c.barcode === payload.barcode && c.id !== id)) {
    return alert('Barcode must be unique for each camera.');
  }

  if (id) {
    const existing = state.cameras.find((c) => c.id === id);
    if (state.currentUser.role === 'Staff' && existing.status !== payload.status) {
      return alert('Staff cannot change maintenance status.');
    }
    Object.assign(existing, payload, { archived: existing.archived });
  } else {
    state.cameras.push(payload);
  }

  $('cameraForm').reset();
  $('cameraId').value = '';
  refreshAll();
});

$('cameraReset').addEventListener('click', () => {
  $('cameraForm').reset();
  $('cameraId').value = '';
});

$('cameraTable').addEventListener('click', (e) => {
  const editId = e.target.dataset.edit;
  const archiveId = e.target.dataset.archive;
  if (editId) {
    const c = state.cameras.find((x) => x.id === editId);
    $('cameraId').value = c.id;
    $('cameraName').value = c.name;
    $('cameraBarcode').value = c.barcode;
    $('cameraSerial').value = c.serial;
    $('cameraStatus').value = c.status;
  }
  if (archiveId) {
    if (state.currentUser.role !== 'Admin') return alert('Only Admin can archive/restore cameras.');
    const c = state.cameras.find((x) => x.id === archiveId);
    c.archived = !c.archived;
    refreshAll();
  }
});

$('borrowForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const camId = $('borrowCamera').value;
  const cam = state.cameras.find((c) => c.id === camId);
  if (!cam || cam.status !== 'Available') return alert('Selected camera is not available.');

  const alreadyBorrowed = state.transactions.some((t) => t.cameraId === camId && !t.returnedAt);
  if (alreadyBorrowed) return alert('Camera already borrowed. Double borrowing blocked.');

  const now = new Date().toISOString();
  state.transactions.push({
    id: crypto.randomUUID(),
    borrowerName: $('borrowerName').value.trim(),
    borrowerId: $('borrowerId').value.trim(),
    department: $('borrowerDept').value.trim(),
    cameraId: cam.id,
    cameraName: cam.name,
    borrowedAt: now,
    expectedReturn: new Date($('expectedReturn').value).toISOString(),
    returnedAt: null,
    approvedBy: $('approvedBy').value.trim(),
    status: 'Borrowed'
  });

  cam.status = 'Borrowed';
  $('borrowForm').reset();
  refreshAll();
});

$('activeBorrowTable').addEventListener('click', (e) => {
  const id = e.target.dataset.return;
  if (!id) return;
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx || tx.returnedAt) return;
  tx.returnedAt = new Date().toISOString();
  tx.status = 'Returned';
  const cam = state.cameras.find((c) => c.id === tx.cameraId);
  if (cam && !cam.archived) cam.status = 'Available';
  refreshAll();
});

$('historyFilter').addEventListener('input', renderTransactions);

$('downloadExcel').addEventListener('click', () => {
  const rows = state.transactions.map((t) => ({
    Borrower: t.borrowerName,
    ID: t.borrowerId,
    Department: t.department,
    Camera: t.cameraName,
    BorrowedAt: fmtDate(t.borrowedAt),
    ExpectedReturn: fmtDate(t.expectedReturn),
    ActualReturn: fmtDate(t.returnedAt),
    ApprovedBy: t.approvedBy,
    Status: t.returnedAt ? 'Returned' : t.status
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, 'camera-inventory-report.xlsx');
});

$('downloadPdf').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text('Camera Inventory Transactions Report', 10, 10);
  let y = 20;
  state.transactions.forEach((t, idx) => {
    const line = `${idx + 1}. ${t.borrowerName} (${t.borrowerId}) | ${t.cameraName} | Borrowed: ${fmtDate(t.borrowedAt)} | Return: ${fmtDate(t.returnedAt)} | ${t.returnedAt ? 'Returned' : t.status}`;
    const wrapped = doc.splitTextToSize(line, 185);
    doc.text(wrapped, 10, y);
    y += wrapped.length * 6;
    if (y > 270) { doc.addPage(); y = 10; }
  });
  doc.save('camera-inventory-report.pdf');
});

seedData();
