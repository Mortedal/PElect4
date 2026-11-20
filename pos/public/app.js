'use strict';

// ======================================================================
// helpers
// ======================================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const peso = (n) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cents = (v) => Math.round((Number(v) || 0) * 100);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const fmtDay = (s, opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Date(s + 'T00:00:00').toLocaleDateString('en-PH', opts);
const CATEGORY = { clothing: 'Clothing', other: 'Other sales' };

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    location.replace('/login');
    throw new Error('Please log in.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}
const send = (url, data, method = 'POST') =>
  api(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

// Close buttons inside dialogs
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-close]');
  if (b) b.closest('dialog').close();
});

// ======================================================================
// state
// ======================================================================
const state = { user: null, date: null, day: null };
const isOwner = () => state.user && state.user.role === 'owner';

// ======================================================================
// photo picker (product photo, payment proof, refund photo)
// ======================================================================
class PhotoPicker {
  constructor(drop) {
    this.drop = drop;
    this.input = $('input', drop);
    this.img = $('img', drop);
    this.hint = $('.hint', drop);
    this.blob = null;
    this.text = '';
    this.required = true;
    this.input.addEventListener('change', () => this.onChange());
  }
  configure(text, required) {
    this.text = text;
    this.required = required;
    if (!this.blob) this.renderHint();
  }
  renderHint() {
    this.hint.innerHTML = this.blob
      ? 'Tap to retake photo'
      : `📷 ${esc(this.text)} <em class="${this.required ? '' : 'optional'}">(${this.required ? 'required' : 'optional'})</em>`;
  }
  async onChange() {
    const file = this.input.files[0];
    this.blob = null;
    if (file) {
      try {
        this.blob = await shrinkImage(file);
      } catch {
        this.blob = file;
      }
    }
    this.show();
  }
  show() {
    if (this.img.src) URL.revokeObjectURL(this.img.src);
    this.img.classList.toggle('hidden', !this.blob);
    this.drop.classList.toggle('has-photo', !!this.blob);
    if (this.blob) this.img.src = URL.createObjectURL(this.blob);
    else this.img.removeAttribute('src');
    this.renderHint();
  }
  reset() {
    this.input.value = '';
    this.blob = null;
    this.show();
  }
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

const productPhoto = new PhotoPicker($('#photoDrop'));
const proofPhoto = new PhotoPicker($('#proofDrop'));
const refundPhoto = new PhotoPicker($('#refundDrop'));
proofPhoto.configure('Take or choose a photo/screenshot of the online payment', true);
refundPhoto.configure('Photo of the returned item or the transfer', true);

// ======================================================================
// tabs
// ======================================================================
function showView(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  $$('.view').forEach((v) => v.classList.add('hidden'));
  $('#view-' + name).classList.remove('hidden');
  if (name === 'register') loadToday();
  if (name === 'history') loadHistory();
  if (name === 'reports') loadReports();
  if (name === 'settings') loadUsers();
}
$$('.tab').forEach((tab) => tab.addEventListener('click', () => showView(tab.dataset.view)));

$('#logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.replace('/login');
});

// ======================================================================
// register
// ======================================================================
async function loadToday() {
  try {
    const { date, day } = await api('/api/today');
    state.date = date;
    state.day = day;
    $('#todayLabel').textContent = fmtDay(date);
    $('#openCard').classList.toggle('hidden', !!day);
    $('#registerOpen').classList.toggle('hidden', !day);
    if (day) renderStats(day);
    if (day && isOwner()) loadTodayActivity();
  } catch (err) {
    alert('Could not load the register: ' + err.message);
  }
}

function renderStats(day) {
  state.day = day;
  $('#statStart').textContent = peso(day.startingCash);
  $('#statDrawer').textContent = peso(day.expectedCash);
  $('#statCount').textContent = day.transactionCount;
  if (isOwner()) {
    $('#statSales').textContent = peso(day.totalSales);
    $('#statOnline').textContent = peso(day.onlineSales);
  }

  const closed = day.isClosed;
  $('#saleForm').classList.toggle('disabled', closed);
  $$('#saleForm input, #saleForm button').forEach((el) => (el.disabled = closed));
  ['#cashInBtn', '#cashOutBtn', '#closeBtn', '#editStartBtn'].forEach((s) => {
    const el = $(s);
    if (el) el.disabled = closed;
  });
  $('#closeBtn').classList.toggle('hidden', closed);
  const banner = $('#closedBanner');
  banner.classList.toggle('hidden', !closed);
  if (closed) {
    if (isOwner() && day.difference != null) {
      const d = day.difference;
      const txt = d === 0 ? 'balanced' : d > 0 ? `over by ${peso(d)}` : `short by ${peso(-d)}`;
      banner.className = 'banner ' + (d === 0 ? 'ok' : 'warn');
      $('#closedText').innerHTML = `Register closed at ${fmtTime(day.closedAt)}${day.closedBy ? ' by ' + esc(day.closedBy) : ''}.
        Counted ${peso(day.countedCash)} vs expected ${peso(day.expectedCash)} — <strong>${txt}</strong>.`;
    } else {
      banner.className = 'banner ok';
      $('#closedText').textContent = `Register closed at ${fmtTime(day.closedAt)}. See you tomorrow!`;
    }
  }
}

$('#openForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#openError').textContent = '';
  try {
    await send('/api/today/open', { startingCash: $('#startingCash').value });
    $('#startingCash').value = '';
    resetSale();
    await loadToday();
  } catch (err) {
    $('#openError').textContent = err.message;
  }
});

// ----- sale form -----
const category = () => $('input[name=category]:checked').value;
const method = () => $('input[name=method]:checked').value;

function addItemRow(focus) {
  const row = $('#itemRow').content.firstElementChild.cloneNode(true);
  $('.i-name', row).placeholder = category() === 'other' ? 'e.g. Rent – Room 3' : 'e.g. Shirt';
  $('.i-remove', row).addEventListener('click', () => {
    if ($('#items').children.length > 1) row.remove();
    else $$('input', row).forEach((i) => (i.value = i.classList.contains('i-qty') ? 1 : ''));
    updateTotals();
  });
  $('#items').appendChild(row);
  if (focus) $('.i-name', row).focus();
}
$('#addItem').addEventListener('click', () => addItemRow(true));
$('#items').addEventListener('input', updateTotals);
$('#cashReceived').addEventListener('input', updateTotals);
$$('input[name=category], input[name=method]').forEach((r) => r.addEventListener('change', applySaleOptions));

function applySaleOptions() {
  const other = category() === 'other';
  $('#itemLabel').textContent = other ? 'Description' : 'Product';
  $$('#items .i-name').forEach((i) => (i.placeholder = other ? 'e.g. Rent – Room 3' : 'e.g. Shirt'));
  productPhoto.configure(other ? 'Photo (e.g. of the receipt)' : 'Take or choose a photo of the product', !other);
  const online = method() === 'online';
  $('#cashSection').classList.toggle('hidden', online);
  $('#onlineSection').classList.toggle('hidden', !online);
  updateTotals();
}

function readItems() {
  return $$('#items .item-row').map((row) => ({
    name: $('.i-name', row).value.trim(),
    price: Number($('.i-price', row).value),
    quantity: Number($('.i-qty', row).value) || 0,
  }));
}
const totalCents = () => readItems().reduce((s, i) => s + cents(i.price) * i.quantity, 0);

function updateTotals() {
  const total = totalCents();
  $('#saleTotal').textContent = peso(total / 100);
  const raw = $('#cashReceived').value;
  const received = cents(raw);
  const box = $('#changeBox');
  const label = $('span', box);
  box.classList.remove('short', 'ok');
  if (raw === '' || total === 0) {
    label.textContent = 'Change to give';
    $('#changeAmount').textContent = peso(0);
  } else if (received < total) {
    box.classList.add('short');
    label.textContent = 'Customer still owes';
    $('#changeAmount').textContent = peso((total - received) / 100);
  } else {
    box.classList.add('ok');
    label.textContent = 'Change to give';
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
  wrap.innerHTML = [...options]
    .sort((a, b) => a - b)
    .slice(0, 5)
    .map((v, i) => `<button type="button" class="chip" data-v="${v}">${i === 0 ? 'Exact ' : ''}${peso(v)}</button>`)
    .join('');
}
$('#quickCash').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  $('#cashReceived').value = b.dataset.v;
  updateTotals();
});

$('#saleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#saleError');
  err.textContent = '';
  const items = readItems();
  const total = totalCents();
  if (items.some((i) => !i.name)) return (err.textContent = 'Every item needs a name.');
  if (items.some((i) => !(i.price > 0))) return (err.textContent = 'Every item needs a price.');
  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) return (err.textContent = 'Quantity must be 1 or more.');
  if (category() === 'clothing' && !productPhoto.blob) return (err.textContent = 'Please take a photo of the product.');
  if (method() === 'cash') {
    if ($('#cashReceived').value === '') return (err.textContent = 'Enter the cash received from the customer.');
    const received = cents($('#cashReceived').value);
    if (received < total) return (err.textContent = `Cash received is short by ${peso((total - received) / 100)}.`);
  } else if (!proofPhoto.blob) {
    return (err.textContent = 'Please add a photo of the online payment.');
  }

  const fd = new FormData();
  fd.append('category', category());
  fd.append('method', method());
  fd.append('items', JSON.stringify(items));
  if (method() === 'cash') fd.append('cashReceived', $('#cashReceived').value);
  else {
    fd.append('reference', $('#reference').value);
    fd.append('proof', proofPhoto.blob, 'proof.jpg');
  }
  if (productPhoto.blob) fd.append('photo', productPhoto.blob, 'product.jpg');

  const btn = $('#saleSubmit');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const { transaction, day } = await api('/api/transactions', { method: 'POST', body: fd });
    renderStats(day);
    showChangeDialog(transaction);
    resetSale();
    if (isOwner()) loadTodayActivity();
  } catch (e2) {
    err.textContent = e2.message;
  } finally {
    btn.disabled = !!(state.day && state.day.isClosed);
    btn.textContent = 'Complete sale';
  }
});

function resetSale() {
  $('#catClothing').checked = true;
  $('#payCash').checked = true;
  $('#items').innerHTML = '';
  addItemRow(false);
  $('#cashReceived').value = '';
  $('#reference').value = '';
  productPhoto.reset();
  proofPhoto.reset();
  $('#saleError').textContent = '';
  applySaleOptions();
}

function showChangeDialog(t) {
  const online = t.method === 'online';
  $('#dlgNumber').textContent = t.number;
  $('#dlgCash').classList.toggle('hidden', online);
  $('#dlgOnline').classList.toggle('hidden', !online);
  $('#dlgChange').textContent = peso(t.change);
  $('#dlgBreakdown').textContent = online
    ? `Total ${peso(t.total)} paid online`
    : `Total ${peso(t.total)} · Received ${peso(t.cashReceived)}`;
  $('#changeDialog').showModal();
}
$('#dlgOk').addEventListener('click', () => {
  $('#changeDialog').close();
  $('#items .i-name')?.focus();
});

// ----- cash in / out -----
let cashType = 'in';
function openCashDialog(type) {
  cashType = type;
  $('#cashTitle').textContent = type === 'in' ? 'Cash in' : 'Cash out';
  $('#cashHelp').textContent =
    type === 'in'
      ? 'Cash added to the drawer, e.g. extra coins or small bills for change.'
      : 'Cash taken from the drawer, e.g. paying for an expense or moving money to the safe.';
  $('#cashReason').placeholder = type === 'in' ? 'e.g. Added coins for change' : 'e.g. Bought water for the store';
  $('#cashAmount').value = '';
  $('#cashReason').value = '';
  $('#cashError').textContent = '';
  $('#cashDialog').showModal();
}
$('#cashInBtn').addEventListener('click', () => openCashDialog('in'));
$('#cashOutBtn').addEventListener('click', () => openCashDialog('out'));
$('#cashForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { day } = await send('/api/cash-movements', {
      type: cashType,
      amount: $('#cashAmount').value,
      reason: $('#cashReason').value,
    });
    $('#cashDialog').close();
    renderStats(day);
    if (isOwner()) loadTodayActivity();
  } catch (err) {
    $('#cashError').textContent = err.message;
  }
});

// ----- close / reopen / edit starting cash -----
$('#closeBtn').addEventListener('click', () => {
  $('#closeExpected').textContent = peso(state.day.expectedCash);
  $('#countedCash').value = '';
  $('#closeNotes').value = '';
  $('#closeError').textContent = '';
  $('#closeDialog').showModal();
});
$('#closeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const day = await send('/api/today/close', { countedCash: $('#countedCash').value, notes: $('#closeNotes').value });
    $('#closeDialog').close();
    renderStats(day);
    if (isOwner()) loadTodayActivity();
  } catch (err) {
    $('#closeError').textContent = err.message;
  }
});
$('#reopenBtn').addEventListener('click', async () => {
  if (!confirm('Reopen today\'s register? The closing count will be cleared.')) return;
  try {
    renderStats(await send('/api/today/reopen', {}));
    loadTodayActivity();
  } catch (err) {
    alert(err.message);
  }
});
$('#editStartBtn').addEventListener('click', () => {
  $('#newStart').value = state.day.startingCash;
  $('#startError').textContent = '';
  $('#startDialog').showModal();
});
$('#startForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    renderStats(await send('/api/today/starting-cash', { startingCash: $('#newStart').value }, 'PATCH'));
    $('#startDialog').close();
  } catch (err) {
    $('#startError').textContent = err.message;
  }
});

// ======================================================================
// owner: lists of sales / refunds / cash movements
// ======================================================================
let dayData = null; // last loaded /api/transactions response (for actions)

function renderTxnList(txns, { canVoid, canRefund }) {
  if (!txns.length) return '<p class="muted">No sales yet.</p>';
  return txns
    .map((t) => {
      const items = t.items.map((i) => `${esc(i.name)}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ');
      const photos = [
        t.photoUrl && `<button class="thumb ${t.proofUrl ? 'small' : ''}" data-photo="${t.photoUrl}" aria-label="View product photo"><img src="${t.photoUrl}" alt="" loading="lazy"></button>`,
        t.proofUrl && `<button class="thumb ${t.photoUrl ? 'small' : ''}" data-photo="${t.proofUrl}" aria-label="View payment proof"><img src="${t.proofUrl}" alt="" loading="lazy"><span class="tag">proof</span></button>`,
      ].filter(Boolean);
      const refundable = t.total - t.refundedTotal;
      const actions = [];
      if (!t.voided && canVoid && t.refundedTotal === 0) actions.push(`<button class="btn ghost small" data-void="${t.id}">Cancel</button>`);
      if (!t.voided && canRefund && refundable > 0) actions.push(`<button class="btn ghost small" data-refund="${t.id}">Refund</button>`);
      return `
      <div class="txn ${t.voided ? 'voided' : ''}">
        <div class="thumbs">${photos.length ? photos.join('') : '<div class="no-photo">no photo</div>'}</div>
        <div style="min-width:0">
          <div class="txn-top">
            <strong>#${t.number}</strong>
            <span class="muted small">${fmtTime(t.createdAt)}${t.cashierName ? ' · ' + esc(t.cashierName) : ''}</span>
            <span class="badge">${CATEGORY[t.category]}</span>
            ${t.method === 'online' ? '<span class="badge online">Online</span>' : ''}
            ${t.voided ? '<span class="badge void">Cancelled</span>' : ''}
            ${t.refundedTotal > 0 ? `<span class="badge refund">Refunded ${peso(t.refundedTotal)}</span>` : ''}
          </div>
          <div class="txn-items">${items}</div>
          <div class="muted small">${
            t.method === 'online'
              ? `Paid online${t.reference ? ' · Ref ' + esc(t.reference) : ''}`
              : `Received ${peso(t.cashReceived)} · Change ${peso(t.change)}`
          }${t.voided ? ` · Cancelled by ${esc(t.voided.byName)}: ${esc(t.voided.reason)}` : ''}</div>
        </div>
        <div class="txn-side">
          <span class="txn-total">${peso(t.total)}</span>
          ${actions.length ? `<div class="btn-row">${actions.join('')}</div>` : ''}
        </div>
      </div>`;
    })
    .join('');
}

function renderRefunds(refunds) {
  return refunds
    .map(
      (r) => `
      <div class="row">
        <button class="thumb" data-photo="${r.photoUrl}" aria-label="View refund photo"><img src="${r.photoUrl}" alt="" loading="lazy"></button>
        <div style="flex:1;min-width:0">
          <div>Refund for sale #${r.transactionNumber}${r.transactionDate !== r.date ? ` of ${esc(r.transactionDate)}` : ''}
            <span class="badge">${r.method === 'cash' ? 'Cash' : 'Online'}</span></div>
          <div class="muted small">${fmtTime(r.createdAt)} · ${esc(r.byName)} · ${esc(r.reason)}</div>
        </div>
        <span class="amt neg">−${peso(r.amount)}</span>
      </div>`
    )
    .join('');
}

function renderMovements(moves) {
  return moves
    .map(
      (m) => `
      <div class="row">
        <div style="min-width:0">
          <div>${m.type === 'in' ? 'Cash in' : 'Cash out'}: ${esc(m.reason)}</div>
          <div class="muted small">${fmtTime(m.createdAt)} · ${esc(m.byName)}</div>
        </div>
        <span class="amt ${m.type === 'out' ? 'neg' : ''}">${m.type === 'in' ? '+' : '−'}${peso(m.amount)}</span>
      </div>`
    )
    .join('');
}

function renderActivity(data, opts) {
  let html = `<div class="txn-list">${renderTxnList(data.transactions, opts)}</div>`;
  if (data.refunds.length) html += `<h3>Refunds</h3><div class="row-list">${renderRefunds(data.refunds)}</div>`;
  if (data.cashMovements.length) html += `<h3>Cash in / out</h3><div class="row-list">${renderMovements(data.cashMovements)}</div>`;
  return html;
}

async function loadTodayActivity() {
  try {
    dayData = await api('/api/transactions?date=' + state.date);
    const open = dayData.day && !dayData.day.isClosed;
    $('#todayActivity').innerHTML = renderActivity(dayData, { canVoid: open, canRefund: open });
  } catch (err) {
    $('#todayActivity').innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

// photo viewer
document.addEventListener('click', (e) => {
  const thumb = e.target.closest('.thumb');
  if (!thumb) return;
  $('#photoDialogImg').src = thumb.dataset.photo;
  $('#photoDialog').showModal();
});

// ----- cancel (void) -----
let actionTxn = null;
let afterAction = null;
const findTxn = (id) => dayData && dayData.transactions.find((t) => t.id === id);

document.addEventListener('click', (e) => {
  const v = e.target.closest('[data-void]');
  const r = e.target.closest('[data-refund]');
  if (!v && !r) return;
  actionTxn = findTxn((v || r).dataset.void || (v || r).dataset.refund);
  if (!actionTxn) return;
  afterAction = e.target.closest('#view-history') ? () => showDay(dayData.date) : loadTodayActivity;
  if (v) {
    $('#voidNumber').textContent = actionTxn.number;
    $('#voidCashNote').textContent =
      actionTxn.method === 'cash' ? ` Give back the ${peso(actionTxn.total)} from the drawer.` : '';
    $('#voidReason').value = '';
    $('#voidError').textContent = '';
    $('#voidDialog').showModal();
  } else {
    const max = actionTxn.total - actionTxn.refundedTotal;
    $('#refundNumber').textContent = actionTxn.number;
    $('#refundSaleTotal').textContent = peso(actionTxn.total);
    $('#refundMax').textContent = peso(max);
    $('#refundAmount').value = max;
    $('#refundAmount').max = max;
    $('#refundReason').value = '';
    $('#refCash').checked = true;
    $('#refundError').textContent = '';
    refundPhoto.reset();
    $('#refundDialog').showModal();
  }
});

$('#voidForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await send(`/api/transactions/${actionTxn.id}/void`, { reason: $('#voidReason').value });
    $('#voidDialog').close();
    await loadToday();
    afterAction();
  } catch (err) {
    $('#voidError').textContent = err.message;
  }
});

$('#refundForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#refundError');
  if (!refundPhoto.blob) return (err.textContent = 'Please add a photo for the refund.');
  const fd = new FormData();
  fd.append('amount', $('#refundAmount').value);
  fd.append('method', $('input[name=refundMethod]:checked').value);
  fd.append('reason', $('#refundReason').value);
  fd.append('photo', refundPhoto.blob, 'refund.jpg');
  $('#refundSubmit').disabled = true;
  try {
    await api(`/api/transactions/${actionTxn.id}/refund`, { method: 'POST', body: fd });
    $('#refundDialog').close();
    await loadToday();
    afterAction();
  } catch (e2) {
    err.textContent = e2.message;
  } finally {
    $('#refundSubmit').disabled = false;
  }
});

// ======================================================================
// history (owner)
// ======================================================================
async function loadHistory() {
  try {
    const days = await api('/api/days');
    $('#dayList').innerHTML = days.length
      ? days
          .map(
            (d) => `
        <button class="day-item" data-date="${d.date}">
          <span><strong>${fmtDay(d.date)}</strong><br>
            <span class="muted small">${d.transactionCount} sale(s) · ${d.isClosed ? 'closed' : 'open'}</span></span>
          <span>${peso(d.netSales)}</span>
        </button>`
          )
          .join('')
      : '<p class="muted">No days recorded yet.</p>';
    const current = $('#historyDate').value || (days[0] && days[0].date);
    if (current) showDay(current);
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
  $('#historyDate').value = date;
  $$('.day-item').forEach((b) => b.classList.toggle('active', b.dataset.date === date));
  const box = $('#historyDetail');
  try {
    dayData = await api('/api/transactions?date=' + date);
    const day = dayData.day;
    if (!day) return (box.innerHTML = `<h2>${fmtDay(date)}</h2><p class="muted">The register was not opened on this day.</p>`);
    const diff =
      day.difference == null ? 'Not closed yet'
        : day.difference === 0 ? 'Balanced'
        : day.difference > 0 ? `Over ${peso(day.difference)}`
        : `Short ${peso(-day.difference)}`;
    const todayOpen = state.day && !state.day.isClosed;
    const cell = (label, value, cls = '') => `<div><span>${label}</span><strong class="${cls}">${value}</strong></div>`;
    box.innerHTML = `
      <div class="card-head">
        <h2>${fmtDay(date)}</h2>
        <a class="btn ghost small" href="/api/export?date=${date}">Download Excel</a>
      </div>
      <div class="summary">
        ${cell('Clothing', peso(day.clothingSales))}
        ${cell('Other sales', peso(day.otherSales))}
        ${cell('Total sales', peso(day.totalSales))}
        ${cell('Refunds', peso(day.refunds))}
        ${cell('Net sales', peso(day.netSales))}
        ${cell('Cash sales', peso(day.cashSales))}
        ${cell('Online sales', peso(day.onlineSales))}
        ${cell('Sales (count)', day.transactionCount + (day.voidedCount ? ` <span class="muted small">+${day.voidedCount} cancelled</span>` : ''))}
        ${cell('Starting cash', peso(day.startingCash))}
        ${cell('Cash in / out', `+${peso(day.cashIn)} / −${peso(day.cashOut)}`)}
        ${cell('Expected in drawer', peso(day.expectedCash))}
        ${cell('Counted at close', day.countedCash == null ? '—' : peso(day.countedCash))}
        ${cell('Difference', diff, day.difference < 0 ? 'neg' : '')}
      </div>
      <p class="muted small">Opened by ${esc(day.openedBy || '—')}${day.closedBy ? ` · closed by ${esc(day.closedBy)}` : ''}${day.notes ? ` · Notes: ${esc(day.notes)}` : ''}</p>
      <h3>Sales</h3>
      ${renderActivity(dayData, { canVoid: dayData.isToday && todayOpen, canRefund: todayOpen })}
      ${!todayOpen ? '<p class="muted small">Open today\'s register to record refunds.</p>' : ''}`;
  } catch (err) {
    box.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

// ======================================================================
// reports (owner)
// ======================================================================
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presetRange(p) {
  const now = new Date(state.date + 'T00:00:00');
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case 'lastMonth': return [new Date(y, m - 1, 1), new Date(y, m, 0), 'day'];
    case 'last7': return [new Date(y, m, now.getDate() - 6), now, 'day'];
    case 'last30': return [new Date(y, m, now.getDate() - 29), now, 'day'];
    case 'thisYear': return [new Date(y, 0, 1), now, 'month'];
    default: return [new Date(y, m, 1), now, 'day'];
  }
}

function applyPreset() {
  const p = $('#repPreset').value;
  if (p === 'custom') return;
  const [from, to, group] = presetRange(p);
  $('#repFrom').value = iso(from);
  $('#repTo').value = iso(to);
  $('#repGroup').value = group;
}
$('#repPreset').addEventListener('change', () => {
  applyPreset();
  loadReports();
});
['#repFrom', '#repTo'].forEach((s) =>
  $(s).addEventListener('change', () => {
    $('#repPreset').value = 'custom';
    loadReports();
  })
);
$('#repGroup').addEventListener('change', loadReports);

async function loadReports() {
  if (!state.date) await loadToday();
  if (!$('#repFrom').value) applyPreset();
  if (!$('#exportMonth').value) $('#exportMonth').value = state.date.slice(0, 7);
  if (!$('#exportDay').value) $('#exportDay').value = state.date;
  try {
    const r = await api(`/api/reports?from=${$('#repFrom').value}&to=${$('#repTo').value}&group=${$('#repGroup').value}`);
    renderReport(r);
  } catch (err) {
    $('#repStats').innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

function bucketLabel(key, group, short) {
  if (group === 'month') return new Date(key + '-01T00:00:00').toLocaleDateString('en-PH', { month: 'short', year: short ? '2-digit' : 'numeric' });
  const d = fmtDay(key, { month: 'short', day: 'numeric' });
  return group === 'week' ? (short ? d : `Week of ${d}`) : d;
}

function renderReport(r) {
  const t = r.totals;
  const stat = (label, value) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;
  $('#repStats').innerHTML = [
    stat('Net sales', peso(t.net)),
    stat('Clothing', peso(t.clothing)),
    stat('Other sales', peso(t.other)),
    stat('Cash', peso(t.cash)),
    stat('Online', peso(t.online)),
    stat('Refunds', peso(t.refunds)),
    stat('Number of sales', t.count),
  ].join('');

  renderChart(r);

  const rows = r.rows
    .map(
      (b) => `<tr><td>${bucketLabel(b.key, r.group)}</td><td>${b.count}</td><td>${peso(b.clothing)}</td><td>${peso(b.other)}</td>
        <td>${peso(b.cash)}</td><td>${peso(b.online)}</td><td>${peso(b.refunds)}</td><td>${peso(b.net)}</td>
        <td>${peso(b.cashIn)}</td><td>${peso(b.cashOut)}</td></tr>`
    )
    .join('');
  $('#repTable').innerHTML = `
    <table>
      <thead><tr><th>${r.group === 'month' ? 'Month' : r.group === 'week' ? 'Week' : 'Day'}</th><th>Sales</th><th>Clothing</th><th>Other</th>
        <th>Cash</th><th>Online</th><th>Refunds</th><th>Net</th><th>Cash in</th><th>Cash out</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Total</td><td>${t.count}</td><td>${peso(t.clothing)}</td><td>${peso(t.other)}</td><td>${peso(t.cash)}</td>
        <td>${peso(t.online)}</td><td>${peso(t.refunds)}</td><td>${peso(t.net)}</td><td>${peso(t.cashIn)}</td><td>${peso(t.cashOut)}</td></tr></tfoot>
    </table>`;
}

// Stacked bar chart: clothing (bottom) + other sales (top) per period.
function niceMax(v) {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
const shortPeso = (v) => (v >= 1000 ? '₱' + (v / 1000).toLocaleString('en-PH', { maximumFractionDigits: 1 }) + 'k' : '₱' + v);

function renderChart(r) {
  const wrap = $('#chartWrap');
  const W = Math.max(wrap.clientWidth, 300);
  const H = 280;
  const pad = { l: 52, r: 8, t: 10, b: 28 };
  const n = r.rows.length;
  const max = niceMax(Math.max(...r.rows.map((b) => b.total), 0));
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const step = plotW / n;
  const barW = Math.max(2, Math.min(40, step * 0.7));
  const y = (v) => pad.t + plotH - (v / max) * plotH;

  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Sales chart">`;
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    svg += `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="axis-text" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${shortPeso(v)}</text>`;
  }
  const labelEvery = Math.ceil(n / Math.floor(plotW / 56));
  r.rows.forEach((b, i) => {
    const x = pad.l + step * i + (step - barW) / 2;
    const segs = [
      { v: b.clothing, color: 'var(--series-1)' },
      { v: b.other, color: 'var(--series-2)' },
    ].filter((s) => s.v > 0);
    let base = 0;
    segs.forEach((s, si) => {
      const top = y(base + s.v);
      const bottom = y(base) - (si > 0 ? 2 : 0); // 2px gap between segments
      const h = Math.max(0, bottom - top);
      const radius = si === segs.length - 1 ? Math.min(4, barW / 2, h) : 0;
      svg += `<path d="${roundedTop(x, top, barW, h, radius)}" fill="${s.color}"/>`;
      base += s.v;
    });
    if (i % labelEvery === 0) {
      svg += `<text class="axis-text" x="${x + barW / 2}" y="${H - 8}" text-anchor="middle">${esc(bucketLabel(b.key, r.group, true))}</text>`;
    }
    svg += `<rect class="hit" data-i="${i}" x="${pad.l + step * i}" y="${pad.t}" width="${step}" height="${plotH}" fill="transparent"/>`;
  });
  svg += '</svg>';
  wrap.innerHTML = svg + '<div class="tooltip hidden"></div>';

  const tip = $('.tooltip', wrap);
  $$('.hit', wrap).forEach((rect) => {
    rect.addEventListener('mouseenter', () => {
      const b = r.rows[rect.dataset.i];
      tip.innerHTML = `<strong>${esc(bucketLabel(b.key, r.group))}</strong><br>
        <i style="background:var(--series-1)"></i>Clothing ${peso(b.clothing)}<br>
        <i style="background:var(--series-2)"></i>Other sales ${peso(b.other)}<br>
        <span class="muted">Total ${peso(b.total)} · ${b.count} sale(s)</span>`;
      tip.classList.remove('hidden');
      const x = Number(rect.getAttribute('x')) + step / 2;
      tip.style.left = Math.min(Math.max(0, x - tip.offsetWidth / 2), W - tip.offsetWidth) + 'px';
      tip.style.top = '0px';
    });
    rect.addEventListener('mouseleave', () => tip.classList.add('hidden'));
  });
}

function roundedTop(x, y, w, h, r) {
  if (h <= 0) return '';
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

window.addEventListener('resize', () => {
  if (!$('#view-reports').classList.contains('hidden')) loadReports();
});

// exports
$('#exportMonthBtn').addEventListener('click', () => {
  if ($('#exportMonth').value) location.href = '/api/export?month=' + $('#exportMonth').value;
});
$('#exportDayBtn').addEventListener('click', () => {
  if ($('#exportDay').value) location.href = '/api/export?date=' + $('#exportDay').value;
});
$('#exportTodayBtn').addEventListener('click', () => (location.href = '/api/export?date=' + state.date));

// ======================================================================
// settings (owner)
// ======================================================================
let users = [];
async function loadUsers() {
  try {
    users = await api('/api/users');
    $('#userList').innerHTML = users
      .map(
        (u) => `
      <div class="row">
        <div><strong>${esc(u.name)}</strong> <span class="badge">${u.role}</span>
          ${u.active ? '' : '<span class="badge void">Turned off</span>'}
          ${u.id === state.user.id ? '<span class="muted small">(you)</span>' : ''}</div>
        <div class="btn-row">
          <button class="btn ghost small" data-pin="${u.id}">Change PIN</button>
          ${u.id === state.user.id ? '' : `<button class="btn ghost small" data-active="${u.id}">${u.active ? 'Turn off' : 'Turn on'}</button>`}
        </div>
      </div>`
      )
      .join('');
  } catch (err) {
    $('#userList').innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

let pinUser = null;
$('#userList').addEventListener('click', async (e) => {
  const p = e.target.closest('[data-pin]');
  const a = e.target.closest('[data-active]');
  if (p) {
    pinUser = users.find((u) => u.id === p.dataset.pin);
    $('#pinUserName').textContent = pinUser.name;
    $('#pinNew').value = '';
    $('#pinError').textContent = '';
    $('#pinDialog').showModal();
  }
  if (a) {
    const u = users.find((x) => x.id === a.dataset.active);
    if (u.active && !confirm(`Turn off ${u.name}? They will not be able to log in.`)) return;
    try {
      await send('/api/users/' + u.id, { active: !u.active }, 'PATCH');
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  }
});
$('#pinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await send('/api/users/' + pinUser.id, { pin: $('#pinNew').value }, 'PATCH');
    $('#pinDialog').close();
  } catch (err) {
    $('#pinError').textContent = err.message;
  }
});
$('#addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#addUserError').textContent = '';
  try {
    await send('/api/users', { name: $('#newName').value, role: $('#newRole').value, pin: $('#newPin').value });
    $('#newName').value = '';
    $('#newPin').value = '';
    loadUsers();
  } catch (err) {
    $('#addUserError').textContent = err.message;
  }
});

// ======================================================================
// init
// ======================================================================
(async () => {
  const status = await api('/api/auth/status');
  if (!status.user) return location.replace('/login');
  state.user = status.user;
  $('#whoName').textContent = status.user.name;
  $('#whoRole').textContent = status.user.role;
  if (!isOwner()) {
    $$('.owner-only').forEach((el) => el.remove());
    $('#tabs').classList.add('hidden');
  }
  resetSale();
  loadToday();
})();
