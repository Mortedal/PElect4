'use strict';

const $ = (sel) => document.querySelector(sel);
let chosenName = null;

async function api(url, data) {
  const res = await fetch(url, {
    method: data ? 'POST' : 'GET',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

async function init() {
  try {
    const status = await api('/api/auth/status');
    if (status.user) return location.replace('/app');
    if (status.setupNeeded) {
      $('#setupCard').classList.remove('hidden');
      $('#setupName').focus();
      return;
    }
    const users = await api('/api/auth/users');
    $('#userGrid').innerHTML = '';
    for (const u of users) {
      const b = document.createElement('button');
      b.className = 'user-tile';
      b.type = 'button';
      b.innerHTML = '<div class="avatar"></div><span class="n"></span><small></small>';
      b.querySelector('.avatar').textContent = u.name.charAt(0).toUpperCase();
      b.querySelector('.n').textContent = u.name;
      b.querySelector('small').textContent = u.role;
      b.addEventListener('click', () => choose(u.name));
      $('#userGrid').appendChild(b);
    }
    $('#loginCard').classList.remove('hidden');
  } catch (err) {
    document.querySelector('main').innerHTML = `<div class="card narrow"><p class="error">Cannot reach the server: ${err.message}</p></div>`;
  }
}

function choose(name) {
  chosenName = name;
  $('#pinName').textContent = name;
  $('#pickUser').classList.add('hidden');
  $('#pinForm').classList.remove('hidden');
  $('#loginError').textContent = '';
  $('#pin').value = '';
  $('#pin').focus();
}

$('#backBtn').addEventListener('click', () => {
  $('#pinForm').classList.add('hidden');
  $('#pickUser').classList.remove('hidden');
});

$('#pinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/auth/login', { name: chosenName, pin: $('#pin').value });
    location.replace('/app');
  } catch (err) {
    $('#loginError').textContent = err.message;
    $('#pin').value = '';
    $('#pin').focus();
  }
});

$('#setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if ($('#setupPin').value !== $('#setupPin2').value) {
    $('#setupError').textContent = 'The two PINs do not match.';
    return;
  }
  try {
    await api('/api/auth/setup', { name: $('#setupName').value, pin: $('#setupPin').value });
    location.replace('/app');
  } catch (err) {
    $('#setupError').textContent = err.message;
  }
});

init();
