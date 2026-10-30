'use strict';

const STORAGE_KEY = 'daily-calendar-todos-v1';
const $ = (selector) => document.querySelector(selector);
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromKey = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
let today = dateKey(new Date());
let viewedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDay = null;
let data = {};
let storageHealthy = true;

function notice(message) { $('#notice').textContent = message; $('#notice').hidden = false; }
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? {} : JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid data');
    for (const [key, items] of Object.entries(parsed)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || dateKey(fromKey(key)) !== key || !Array.isArray(items)) throw new Error('Invalid date');
      const ids = new Set();
      for (const item of items) {
        if (!item || typeof item.id !== 'string' || ids.has(item.id) || typeof item.text !== 'string' || typeof item.done !== 'boolean') throw new Error('Invalid item');
        ids.add(item.id);
      }
    }
    data = parsed;
  } catch {
    storageHealthy = false;
    notice('저장된 목록을 불러올 수 없습니다. 기존 데이터 보호를 위해 자동 저장을 중단했습니다.');
  }
}
const tasksFor = (key) => data[key] || [];
function saveData() {
  if (!storageHealthy) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { notice('저장 실패. 현재 변경 내용은 새로고침하면 사라질 수 있습니다.'); }
}
function renderToday() {
  $('#today-date').textContent = fromKey(today).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const container = $('#today-summary'); container.replaceChildren();
  const tasks = tasksFor(today);
  if (!tasks.length) { const p = document.createElement('p'); p.textContent = '등록된 할 일 없음'; container.append(p); }
  else {
    const list = document.createElement('ul'); list.className = 'summary-list';
    tasks.slice(0, 3).forEach((task) => {
      const li = document.createElement('li'); li.classList.toggle('done', task.done);
      const label = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.done;
      checkbox.addEventListener('change', () => {
        task.done = checkbox.checked;
        li.classList.toggle('done', task.done);
        saveData();
        renderDay();
      });
      const text = document.createElement('span'); text.textContent = task.text;
      label.append(checkbox, text); li.append(label); list.append(li);
    });
    container.append(list);
    if (tasks.length > 3) { const p = document.createElement('p'); p.textContent = `외 ${tasks.length - 3}개의 할 일`; container.append(p); }
  }
}
function renderCalendar() {
  $('#month-title').textContent = `${viewedMonth.getFullYear()}년 ${viewedMonth.getMonth() + 1}월`;
  const container = $('#calendar'); container.replaceChildren();
  const first = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const total = Math.ceil((first.getDay() + days) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const date = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + i);
    const key = dateKey(date); const count = tasksFor(key).length;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'day';
    button.classList.toggle('other', date.getMonth() !== first.getMonth());
    button.classList.toggle('today', key === today);
    button.classList.toggle('sunday', date.getDay() === 0); button.classList.toggle('saturday', date.getDay() === 6);
    button.dataset.date = key;
    button.setAttribute('aria-label', `${date.toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric',weekday:'long'})}${key === today ? ', 오늘' : ''}, 할 일 ${count}개`);
    if (key === today) button.setAttribute('aria-current', 'date');
    const number = document.createElement('span'); number.className = 'day-number'; number.textContent = date.getDate(); button.append(number);
    if (count) { const dot = document.createElement('i'); dot.className = 'dot'; dot.setAttribute('aria-hidden', 'true'); button.append(dot); }
    button.addEventListener('click', () => openDay(key)); container.append(button);
  }
}
function renderDay() {
  if (!selectedDay) return;
  const tasks = tasksFor(selectedDay);
  const list = $('#todo-list'); list.replaceChildren();
  tasks.forEach(task => {
    const li = document.createElement('li'); li.className = 'todo-row'; li.classList.toggle('done', task.done);
    const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.done;
    checkbox.addEventListener('change', () => { task.done = checkbox.checked; li.classList.toggle('done', task.done); saveData(); renderToday(); renderCalendar(); });
    const text = document.createElement('span'); text.textContent = task.text; label.append(checkbox, text);
    const remove = document.createElement('button'); remove.className = 'delete-button'; remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `${task.text} 삭제`);
    remove.addEventListener('click', () => { const index = tasksFor(selectedDay).findIndex(item => item.id === task.id); if (index < 0) return; data[selectedDay].splice(index, 1); if (!data[selectedDay].length) delete data[selectedDay]; saveData(); renderAll(); const targets = list.querySelectorAll('.delete-button'); (targets[Math.min(index, targets.length - 1)] || $('#todo-input')).focus(); });
    li.append(label, remove); list.append(li);
  });
}
function renderAll() { renderToday(); renderCalendar(); renderDay(); }
function openDay(key) { selectedDay = key; $('#todo-input').value = ''; renderDay(); $('#day-dialog').showModal(); $('#close-dialog').focus(); }
$('#close-dialog').addEventListener('click', () => $('#day-dialog').close());
$('#day-dialog').addEventListener('close', () => { const previous = selectedDay; selectedDay = null; document.querySelector(`[data-date="${previous}"]`)?.focus(); });
$('#day-dialog').addEventListener('click', event => { if (event.target !== $('#day-dialog')) return; const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); });
$('#open-today').addEventListener('click', () => openDay(today));
$('#prev-month').addEventListener('click', () => { viewedMonth.setMonth(viewedMonth.getMonth() - 1); renderCalendar(); });
$('#next-month').addEventListener('click', () => { viewedMonth.setMonth(viewedMonth.getMonth() + 1); renderCalendar(); });
$('#go-today').addEventListener('click', () => { const date = fromKey(today); viewedMonth = new Date(date.getFullYear(), date.getMonth(), 1); renderCalendar(); });
$('#todo-form').addEventListener('submit', event => {
  event.preventDefault(); const input = $('#todo-input'); const text = input.value.trim();
  if (!text || !selectedDay) { input.focus(); return; }
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (!data[selectedDay]) data[selectedDay] = [];
  data[selectedDay].push({ id, text, done: false }); input.value = ''; saveData(); renderAll(); input.focus();
});
function refreshDate() { const current = dateKey(new Date()); if (current !== today) { today = current; renderAll(); } }
window.addEventListener('focus', refreshDate);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDate(); });
setInterval(refreshDate, 60000);
loadData(); renderAll();
