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
  openedSwipe?.close();
  $('#today-date').textContent = fromKey(today).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const container = $('#today-summary'); container.replaceChildren();
  const tasks = tasksFor(today);
  if (!tasks.length) { const p = document.createElement('p'); p.textContent = '등록된 할 일 없음'; container.append(p); }
  else {
    const list = document.createElement('ul'); list.className = 'summary-list';
    tasks.slice(0, 3).forEach((task) => {
      list.append(createTaskRow(task, today, true));
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
  $('#day-title').textContent = fromKey(selectedDay).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const tasks = tasksFor(selectedDay);
  const list = $('#todo-list'); list.replaceChildren();
  tasks.forEach(task => {
    list.append(createTaskRow(task, selectedDay));
  });
}
function renderAll() { cancelGesture?.(); renderToday(); renderCalendar(); renderDay(); }
let activeTask = null;
let cancelGesture = null;
let openedSwipe = null;

document.addEventListener('pointerdown', event => {
  if (openedSwipe && !openedSwipe.row.contains(event.target)) openedSwipe.close();
}, { capture: true });

function createTaskRow(task, key, summary = false) {
  const li = document.createElement('li'); li.className = 'todo-row'; li.dataset.id = task.id;
  li.classList.toggle('done', task.done);
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.done;
  checkbox.setAttribute('aria-label', `${task.text} 완료`);
  checkbox.addEventListener('change', () => {
    task.done = checkbox.checked;
    if (task.done) {
      const tasks = tasksFor(key);
      const index = tasks.findIndex(item => item.id === task.id);
      if (index >= 0) tasks.push(...tasks.splice(index, 1));
    }
    saveData(); renderAll();
  });
  const text = document.createElement('button'); text.type = 'button'; text.className = 'task-text'; text.textContent = task.text;
  text.setAttribute('aria-label', `${task.text}, 내용, 날짜 및 순서 변경`);
  const surface = summary ? document.createElement('div') : li;
  if (summary) { li.classList.add('swipe-row'); surface.className = 'summary-content'; li.append(surface); }
  surface.append(checkbox, text);
  const remove = document.createElement('button'); remove.className = summary ? 'swipe-delete' : 'delete-button'; remove.type = 'button'; remove.textContent = summary ? '삭제' : '×'; remove.setAttribute('aria-label', `${task.text} 삭제`);
  remove.addEventListener('click', () => {
    const index = tasksFor(key).findIndex(item => item.id === task.id); if (index < 0) return;
    data[key].splice(index, 1); if (!data[key].length) delete data[key];
    saveData(); renderAll();
    const targets = $(summary ? '#today-summary' : '#todo-list').querySelectorAll(summary ? '.task-text' : '.delete-button');
    (targets[Math.min(index, targets.length - 1)] || $(summary ? '#open-today' : '#todo-input')).focus();
  });
  li.append(remove);
  const swipe = summary ? createSwipeControl(li, surface, remove) : null;
  attachTaskGesture(text, li, task, key, swipe);
  return li;
}

function createSwipeControl(row, surface, remove) {
  const swipe = {
    row, surface, offset: 0, isOpen: false, width: 80,
    set(offset) {
      this.offset = Math.max(-this.width, Math.min(0, offset));
      surface.style.transform = `translateX(${this.offset}px)`;
      row.classList.toggle('swipe-revealed', this.offset < 0);
    },
    settle(open) {
      row.classList.remove('swiping');
      this.isOpen = open;
      this.set(open ? -this.width : 0);
      remove.disabled = !open; remove.tabIndex = open ? 0 : -1;
      remove.setAttribute('aria-hidden', String(!open));
      if (open) { if (openedSwipe !== this) openedSwipe?.close(); openedSwipe = this; }
      else if (openedSwipe === this) openedSwipe = null;
    },
    close() { this.settle(false); }
  };
  swipe.close();
  surface.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); swipe.settle(true); remove.focus(); }
  });
  row.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key === 'ArrowRight') { swipe.close(); row.querySelector('.task-text').focus(); }
  });
  return swipe;
}

function openTask(task, key) {
  activeTask = { id: task.id, key };
  $('#task-text').textContent = task.text;
  $('#move-date').value = key;
  $('#move-date-form').hidden = true;
  $('#edit-task-form').hidden = true;
  $('#edit-task-input').value = task.text;
  $('#edit-task-error').hidden = true;
  const index = tasksFor(key).findIndex(item => item.id === task.id);
  $('#move-up').disabled = index <= 0;
  $('#move-down').disabled = index === tasksFor(key).length - 1;
  $('#task-dialog').showModal();
}

function moveTaskTo(target) {
  if (!activeTask || !/^\d{4}-\d{2}-\d{2}$/.test(target) || dateKey(fromKey(target)) !== target) return;
  const { id, key } = activeTask;
  const source = tasksFor(key); const index = source.findIndex(task => task.id === id);
  if (index < 0) return;
  if (target !== key) {
    const [task] = source.splice(index, 1);
    if (!source.length) delete data[key];
    if (!data[target]) data[target] = [];
    data[target].push(task);
    saveData();
  }
  $('#task-dialog').close(); renderAll();
  const message = `${fromKey(target).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 목록으로 옮겼습니다.`;
  notice(message); $('#day-notice').textContent = message; $('#day-notice').hidden = false;
}

$('#close-task').addEventListener('click', () => $('#task-dialog').close());
$('#task-dialog').addEventListener('close', () => { activeTask = null; });
$('#move-tomorrow').addEventListener('click', () => {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); moveTaskTo(dateKey(tomorrow));
});
$('#choose-date').addEventListener('click', () => { $('#edit-task-form').hidden = true; $('#move-date-form').hidden = false; $('#move-date').focus(); });
$('#move-date-form').addEventListener('submit', event => { event.preventDefault(); moveTaskTo($('#move-date').value); });
$('#edit-task').addEventListener('click', () => {
  if (!activeTask) return;
  const task = tasksFor(activeTask.key).find(item => item.id === activeTask.id);
  if (!task) return;
  $('#move-date-form').hidden = true;
  $('#edit-task-form').hidden = false;
  $('#edit-task-error').hidden = true;
  $('#edit-task-input').value = task.text;
  $('#edit-task-input').focus();
});
$('#cancel-edit').addEventListener('click', () => { $('#edit-task-form').hidden = true; $('#edit-task').focus(); });
$('#edit-task-input').addEventListener('input', () => { $('#edit-task-error').hidden = true; });
$('#edit-task-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!activeTask) return;
  const input = $('#edit-task-input'); const text = input.value.trim();
  if (!text) { $('#edit-task-error').hidden = false; input.focus(); return; }
  const task = tasksFor(activeTask.key).find(item => item.id === activeTask.id);
  if (!task) return;
  task.text = text;
  saveData(); $('#task-dialog').close(); renderAll();
});
for (const [selector, step] of [['#move-up', -1], ['#move-down', 1]]) {
  $(selector).addEventListener('click', () => {
    if (!activeTask) return;
    const tasks = tasksFor(activeTask.key); const index = tasks.findIndex(task => task.id === activeTask.id);
    if (index < 0 || index + step < 0 || index + step >= tasks.length) return;
    [tasks[index], tasks[index + step]] = [tasks[index + step], tasks[index]];
    saveData(); $('#task-dialog').close(); renderAll();
  });
}

// Wait for a stationary long press so ordinary vertical swipes still scroll on iPhone.
function attachTaskGesture(button, row, task, key, swipe = null) {
  let pending = null;
  let suppressClickUntil = 0;
  const surface = swipe?.surface || button;
  surface.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil || swipe?.isOpen) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (Date.now() >= suppressClickUntil) swipe?.close();
    }
  }, { capture: true });
  button.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
    openTask(task, key);
  });
  button.addEventListener('contextmenu', event => event.preventDefault());
  function finish(commit) {
    if (!pending) return;
    const state = pending; pending = null;
    clearTimeout(state.timer); cancelAnimationFrame(state.frame);
    window.removeEventListener('pointermove', mouseMove);
    window.removeEventListener('pointerup', mouseEnd);
    window.removeEventListener('pointercancel', abort);
    cancelGesture = null;
    if (state.swiping) {
      suppressClickUntil = Date.now() + 700;
      swipe.settle(commit ? swipe.offset < -swipe.width / 2 : state.swipeStart < 0);
      return;
    }
    if (!state.dragging) return;
    suppressClickUntil = Date.now() + 700;
    state.ghost.remove(); row.classList.remove('drag-placeholder');
    document.body.classList.remove('reordering');
    if (commit) {
      // A summary only shows three rows: preserve the position of all hidden tasks.
      const ids = [...state.list.children].map(item => item.dataset.id);
      const visible = new Map(tasksFor(key).filter(item => ids.includes(item.id)).map(item => [item.id, item]));
      let index = 0;
      data[key] = tasksFor(key).map(item => visible.has(item.id) ? visible.get(ids[index++]) : item);
      saveData();
    }
    renderAll();
  }
  function abort() { finish(false); }
  function position() {
    const state = pending; if (!state?.dragging) return;
    const top = state.y - state.offset;
    state.ghost.style.top = `${top}px`;
    state.ghost.style.left = `${state.left}px`;
    // Match viewport touch coordinates even if the overlay's positioning origin differs.
    const actual = state.ghost.getBoundingClientRect();
    state.ghost.style.top = `${top + (top - actual.top)}px`;
    state.ghost.style.left = `${state.left + (state.left - actual.left)}px`;
    const siblings = [...state.list.children].filter(item => item !== row);
    const next = siblings.find(item => { const rect = item.getBoundingClientRect(); return state.y < rect.top + rect.height / 2; });
    state.list.insertBefore(row, next || null);
  }
  function tick() {
    const state = pending; if (!state?.dragging) return;
    const scroller = row.closest('dialog') || document.scrollingElement;
    const bounds = row.closest('dialog')?.getBoundingClientRect() || { top: 0, bottom: window.innerHeight };
    const speed = state.y < bounds.top + 65 ? -8 : state.y > bounds.bottom - 65 ? 8 : 0;
    if (speed) { scroller.scrollTop += speed; position(); }
    state.frame = requestAnimationFrame(tick);
  }
  function begin(x, y) {
    cancelGesture?.();
    if (openedSwipe !== swipe) openedSwipe?.close();
    const state = { x, y, startY: y, list: row.parentElement, dragging: false, swipeStart: swipe?.offset || 0 };
    pending = state; cancelGesture = abort;
    state.timer = setTimeout(() => {
      if (pending !== state) return;
      swipe?.close();
      const rect = row.getBoundingClientRect();
      state.dragging = true; state.offset = state.y - rect.top; state.left = rect.left;
      // Keep the original row layout so the text stays exactly where it was pressed.
      const ghost = document.createElement('ul'); ghost.className = `${state.list.className} drag-ghost`;
      const appearance = getComputedStyle(row);
      ghost.style.font = appearance.font; ghost.style.color = appearance.color;
      ghost.append(row.cloneNode(true)); ghost.inert = true;
      ghost.setAttribute('aria-hidden', 'true'); ghost.style.width = `${rect.width}px`;
      state.ghost = ghost;
      (row.closest('dialog') || document.body).append(ghost);
      row.classList.add('drag-placeholder'); document.body.classList.add('reordering');
      suppressClickUntil = Date.now() + 700;
      position(); tick();
    }, 450);
  }
  function move(x, y, event) {
    if (!pending) return;
    const dx = x - pending.x; const dy = y - pending.startY;
    if (!pending.dragging && !pending.swiping && Math.hypot(dx, dy) > 10) {
      if (swipe && Math.abs(dx) > Math.abs(dy) * 1.2) {
        clearTimeout(pending.timer); pending.swiping = true;
        row.classList.add('swiping');
      } else { suppressClickUntil = Date.now() + 700; finish(false); return; }
    }
    if (pending.swiping) {
      if (event.cancelable) event.preventDefault();
      swipe.set(pending.swipeStart + dx);
      return;
    }
    pending.y = y;
    if (pending.dragging) { if (event.cancelable) event.preventDefault(); position(); }
  }
  surface.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { abort(); return; }
    const touch = event.touches[0]; begin(touch.clientX, touch.clientY);
  }, { passive: true });
  surface.addEventListener('touchmove', event => {
    if (event.touches.length !== 1) { abort(); return; }
    const touch = event.touches[0]; move(touch.clientX, touch.clientY, event);
  }, { passive: false });
  surface.addEventListener('touchend', event => {
    if ((pending?.dragging || pending?.swiping) && event.cancelable) event.preventDefault();
    finish(true);
  }, { passive: false });
  surface.addEventListener('touchcancel', abort);
  function mouseMove(event) { move(event.clientX, event.clientY, event); }
  function mouseEnd() { finish(true); }
  surface.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    begin(event.clientX, event.clientY);
    window.addEventListener('pointermove', mouseMove);
    window.addEventListener('pointerup', mouseEnd);
    window.addEventListener('pointercancel', abort);
  });
}
window.addEventListener('blur', () => cancelGesture?.());
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGesture?.(); });
$('#day-dialog').addEventListener('cancel', () => cancelGesture?.());
function openDay(key) { selectedDay = key; $('#todo-input').value = ''; $('#day-notice').hidden = true; renderDay(); $('#day-dialog').showModal(); $('#close-dialog').focus(); }
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
