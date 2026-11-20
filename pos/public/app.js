'use strict';

const $ = (sel) => document.querySelector(sel);
const peso = (n) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cents = (v) => Math.round((Number(v) || 0) * 100);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}
const postJSON = (url, data) =>
  api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

let state = { date: null, day: null };
let photoBlob = null;

// ---------------- tabs ----------------
document.querySelectorAll('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    $('#view-' + tab.dataset.view).classList.remove('hidden');
    if (tab.dataset.view === 'history') loadHistory();
    else loadToday();
  })
);

// ---------------- register ----------------
async function loadToday() {
  try {
    const { date, day } = await api('/api/today');
    state.date = date;
    state.day = day;
    $('#todayLabel').textContent = new Date(date + 'T00:00:00').toLocaleDateString('en-PH', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
    $('#openCard').classList.toggle('hidden', !!day);
    $('#registerOpen').classList.toggle('hidden', !day);
    if (day) {
      renderStats(day);
      const { transactions } = await api('/api/transactions?date=' + date);
      $('#todayList').innerHTML = renderTxnList(transactions);
    }
  } catch (err) {
    alert('Could not load register: ' + err.message);
  }
}

function renderStats(day) {
  $('#statStart').textContent = peso(day.startingCash);
  $('#statSales').textContent = peso(day.totalSales);
  $('#statCount').textContent = day.transactionCount;
  $('#statDrawer').textContent = peso(day.expectedCash);

  const closed = day.isClosed;
  $('#saleForm').classList.toggle('disabled', closed);
  $('#saleForm').querySelectorAll('input, button').forEach((el) => (el.disabled = closed));
  $('#closeBtn').classList.toggle('hidden', closed);
  const banner = $('#closedBanner');
  banner.classList.toggle('hidden', !closed);
  if (closed) {
    const diff = day.difference;
    const diffText = diff === 0 ? 'balanced' : diff > 0 ? `over by ${peso(diff)}` : `short by ${peso(-diff)}`;
    banner.className = 'banner ' + (diff === 0 ? 'ok' : 'warn');
    banner.innerHTML = `Register closed at ${fmtTime(day.closedAt)}. Counted ${peso(day.countedCash)}
      vs expected ${peso(day.expectedCash)} — <strong>${diffText}</strong>.`;
  }
}

$('#openForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await postJSON('/api/today/open', { startingCash: $('#startingCash').value });
    $('#startingCash').value = '';
    await loadToday();
    resetSale();
  } catch (err) {
    alert(err.message);
  }
});

// ----- sale form -----
function addItemRow(focus) {
  const row = $('#itemRow').content.firstElementChild.cloneNode(true);
  row.querySelector('.i-remove').addEventListener('click', () => {
    if ($('#items').children.length > 1) row.remove();
    else row.querySelectorAll('input').forEach((i) => (i.value = i.classList.contains('i-qty') ? 1 : ''));
    updateTotals();
  });
  $('#items').appendChild(row);
  if (focus) row.querySelector('.i-name').focus();
}
$('#addItem').addEventListener('click', () => addItemRow(true));
$('#items').addEventListener('input', updateTotals);
$('#cashReceived').addEventListener('input', updateTotals);

function readItems() {
  return [...$('#items').children].map((row) => ({
    name: row.querySelector('.i-name').value.trim(),
    price: Number(row.querySelector('.i-price').value),
    quantity: Number(row.querySelector('.i-qty').value) || 0,
  }));
}

function totalCents() {
  return readItems().reduce((s, i) => s + cents(i.price) * i.quantity, 0);
}

function updateTotals() {
  const total = totalCents();
  $('#saleTotal').textContent = peso(total / 100);

  const raw = $('#cashReceived').value;
  const box = $('#changeBox');
  const received = cents(raw);
  box.classList.remove('short', 'ok');
  if (raw === '' || total === 0) {
    $('#changeAmount').textContent = peso(0);
    box.querySelector('span').textContent = 'Change to give';
  } else if (received < total) {
    box.classList.add('short');
    box.querySelector('span').textContent = 'Customer still owes';
    $('#changeAmount').textContent = peso((total - received) / 100);
  } else {
    box.classList.add('ok');
    box.querySelector('span').textContent = 'Change to give';
    $('#changeAmount').textContent = peso((received - total) / 100);
  }
  renderQuickCash(total);
}

// Quick buttons: exact amount and the next common bills above the total.
function renderQuickCash(total) {
  const wrap = $('#quickCash');
  if (total === 0) return (wrap.innerHTML = '');
  const pesos = total / 100;
  const options = new Set([pesos]);
  for (const bill of [50, 100, 500, 1000]) {
    const v = Math.ceil(pesos / bill) * bill;
    if (v > pesos) options.add(v);
  }
  const list = [...options].sort((a, b) => a - b).slice(0, 5);
  wrap.innerHTML = list
    .map((v, i) => `<button type="button" class="chip" data-v="${v}">${i === 0 ? 'Exact ' : ''}${peso(v)}</button>`)
    .join('');
}
$('#quickCash').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  $('#cashReceived').value = b.dataset.v;
  updateTotals();
});

// ----- photo -----
$('#photo').addEventListener('change', async () => {
  const file = $('#photo').files[0];
  photoBlob = null;
  if (!file) return showPreview(null);
  try {
    photoBlob = await shrinkImage(file);
    showPreview(URL.createObjectURL(photoBlob));
  } catch {
    photoBlob = file; // fall back to the original file
    showPreview(URL.createObjectURL(file));
  }
});

function showPreview(url) {
  const img = $('#photoPreview');
  if (img.src) URL.revokeObjectURL(img.src);
  img.classList.toggle('hidden', !url);
  $('#photoDrop').classList.toggle('has-photo', !!url);
  if (url) img.src = url;
  else img.removeAttribute('src');
  $('#photoHint').innerHTML = url
    ? 'Tap to retake photo'
    : '📷 Take or choose a photo of the product <em>(required)</em>';
}

// Resize to max 1280px and re-encode as JPEG so uploads stay small.
async function shrinkImage(file, max = 1280, quality = 0.8) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality)
  );
}

// ----- submit sale -----
$('#saleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#saleError');
  err.textContent = '';
  const total = totalCents();
  const received = cents($('#cashReceived').value);
  if (!photoBlob) return (err.textContent = 'Please take or choose a photo of the product.');
  if (total <= 0) return (err.textContent = 'Enter the product price.');
  if (received < total) return (err.textContent = `Cash received is short by ${peso((total - received) / 100)}.`);

  const fd = new FormData();
  fd.append('items', JSON.stringify(readItems()));
  fd.append('cashReceived', $('#cashReceived').value);
  fd.append('photo', photoBlob, 'product.jpg');

  const btn = $('#saleSubmit');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const { transaction, day } = await api('/api/transactions', { method: 'POST', body: fd });
    state.day = day;
    renderStats(day);
    showChangeDialog(transaction);
    resetSale();
    const { transactions } = await api('/api/transactions?date=' + state.date);
    $('#todayList').innerHTML = renderTxnList(transactions);
  } catch (e2) {
    err.textContent = e2.message;
  } finally {
    btn.disabled = !!(state.day && state.day.isClosed);
    btn.textContent = 'Complete sale';
  }
});

function resetSale() {
  $('#items').innerHTML = '';
  addItemRow(false);
  $('#cashReceived').value = '';
  $('#photo').value = '';
  photoBlob = null;
  showPreview(null);
  $('#saleError').textContent = '';
  updateTotals();
}

function showChangeDialog(t) {
  $('#dlgNumber').textContent = t.number;
  $('#dlgChange').textContent = peso(t.change);
  $('#dlgBreakdown').textContent = `Total ${peso(t.total)} · Received ${peso(t.cashReceived)}`;
  $('#changeDialog').showModal();
}
$('#dlgOk').addEventListener('click', () => {
  $('#changeDialog').close();
  $('#items .i-name')?.focus();
});

// ----- close register -----
$('#closeBtn').addEventListener('click', () => {
  $('#closeExpected').textContent = peso(state.day.expectedCash);
  $('#countedCash').value = '';
  $('#closeNotes').value = '';
  $('#closeError').textContent = '';
  $('#closeDialog').showModal();
});
$('#closeCancel').addEventListener('click', () => $('#closeDialog').close());
$('#closeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await postJSON('/api/today/close', { countedCash: $('#countedCash').value, notes: $('#closeNotes').value });
    $('#closeDialog').close();
    await loadToday();
  } catch (err) {
    $('#closeError').textContent = err.message;
  }
});

// ---------------- transactions list ----------------
function renderTxnList(txns) {
  if (!txns.length) return '<p class="muted">No transactions yet.</p>';
  return txns
    .map((t) => {
      const items = t.items
        .map((i) => `${esc(i.name)}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
        .join(', ');
      return `
      <div class="txn">
        <button class="thumb" data-photo="${t.photoUrl}" aria-label="View photo">
          <img src="${t.photoUrl}" alt="" loading="lazy">
        </button>
        <div class="txn-main">
          <div class="txn-top"><strong>#${t.number}</strong> <span class="muted">${fmtTime(t.createdAt)}</span></div>
          <div class="txn-items">${items}</div>
          <div class="muted small">Received ${peso(t.cashReceived)} · Change ${peso(t.change)}</div>
        </div>
        <div class="txn-total">${peso(t.total)}</div>
      </div>`;
    })
    .join('');
}

document.addEventListener('click', (e) => {
  const thumb = e.target.closest('.thumb');
  if (!thumb) return;
  $('#photoDialogImg').src = thumb.dataset.photo;
  $('#photoDialog').showModal();
});
$('#photoDialogClose').addEventListener('click', () => $('#photoDialog').close());

// ---------------- history ----------------
async function loadHistory() {
  try {
    const days = await api('/api/days');
    $('#dayList').innerHTML = days.length
      ? days
          .map(
            (d) => `
        <button class="day-item" data-date="${d.date}">
          <span><strong>${d.date}</strong><br><span class="muted small">${d.transactionCount} sale(s)${d.isClosed ? ' · closed' : ' · open'}</span></span>
          <span>${peso(d.totalSales)}</span>
        </button>`
          )
          .join('')
      : '<p class="muted">No days recorded yet.</p>';
    if (days.length && !$('#historyDate').value) showDay(days[0].date);
  } catch (err) {
    $('#dayList').innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

$('#dayList').addEventListener('click', (e) => {
  const b = e.target.closest('.day-item');
  if (b) showDay(b.dataset.date);
});
$('#historyDate').addEventListener('change', () => {
  if ($('#historyDate').value) showDay($('#historyDate').value);
});

async function showDay(date) {
  document.querySelectorAll('.day-item').forEach((b) => b.classList.toggle('active', b.dataset.date === date));
  const box = $('#historyDetail');
  try {
    const { day, transactions } = await api('/api/transactions?date=' + date);
    if (!day) return (box.innerHTML = `<h2>${date}</h2><p class="muted">The register was not opened on this day.</p>`);
    const diff =
      day.difference == null
        ? 'Not closed yet'
        : day.difference === 0
          ? 'Balanced'
          : day.difference > 0
            ? `Over ${peso(day.difference)}`
            : `Short ${peso(-day.difference)}`;
    box.innerHTML = `
      <h2>${date}</h2>
      <div class="summary">
        <div><span>Starting cash</span><strong>${peso(day.startingCash)}</strong></div>
        <div><span>Total sales</span><strong>${peso(day.totalSales)}</strong></div>
        <div><span>Transactions</span><strong>${day.transactionCount}</strong></div>
        <div><span>Cash received</span><strong>${peso(day.cashReceived)}</strong></div>
        <div><span>Change given</span><strong>${peso(day.changeGiven)}</strong></div>
        <div><span>Expected in drawer</span><strong>${peso(day.expectedCash)}</strong></div>
        <div><span>Counted at close</span><strong>${day.countedCash == null ? '—' : peso(day.countedCash)}</strong></div>
        <div><span>Difference</span><strong class="${day.difference < 0 ? 'neg' : ''}">${diff}</strong></div>
      </div>
      ${day.notes ? `<p class="muted">Notes: ${esc(day.notes)}</p>` : ''}
      <h3>Transactions</h3>
      <div class="txn-list">${renderTxnList(transactions)}</div>`;
  } catch (err) {
    box.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

// ---------------- init ----------------
resetSale();
loadToday();
