/* Sadhana Tracker — offline daily sadhana log with weekly PDF card export */
(function () {
'use strict';

// ---------- utilities ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON3 = MON.map(m => m.slice(0, 3));
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const w = (x.getDay() + 6) % 7; return addDays(x, -w); };
const weekDays = mon => Array.from({ length: 7 }, (_, i) => addDays(mon, i));
const weekLabel = mon => `${MON[mon.getMonth()]} ${String(mon.getFullYear()).slice(2)} (Week ${Math.ceil(mon.getDate() / 7)})`;
const rangeLabel = mon => { const e = addDays(mon, 6); return `${mon.getDate()} ${MON3[mon.getMonth()]} – ${e.getDate()} ${MON3[e.getMonth()]} ${e.getFullYear()}`; };
const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt12 = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(m)}${ap}`; };
const fmt12s = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; };
const dur = m => { if (!m) return '0m'; const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };
const uid = () => Math.random().toString(36).slice(2, 9);
const sum = a => a.reduce((x, y) => x + (+y || 0), 0);

const ICON = {
  bed: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h2v7h6V8h7a3 3 0 0 1 3 3v8h-2v-3H5v3H3zm5 2.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 5v3M5.2 9.2l2 2M18.8 9.2l-2 2M2 14h2M20 14h2"/></svg>',
  head: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h2v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h2a3 3 0 0 0 3-3v-6a9 9 0 0 0-9-9z"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5l5 5 5-5M4 21h16"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  mala: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="4" r="1.6"/><circle cx="17" cy="5.6" r="1.6"/><circle cx="19.6" cy="10" r="1.6"/><circle cx="18.6" cy="15" r="1.6"/><circle cx="7" cy="5.6" r="1.6"/><circle cx="4.4" cy="10" r="1.6"/><circle cx="5.4" cy="15" r="1.6"/><path d="M12 16l-2 5h4z"/></svg>'
};

// ---------- storage (native bridge on Android, localStorage in browsers) ----------
const Bridge = window.AndroidBridge || null;
const STORE_KEY = 'sadhana.v1';
const Store = {
  load() {
    try {
      const raw = Bridge ? Bridge.load() : localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  save(s) {
    const j = JSON.stringify(s);
    try { if (Bridge) Bridge.save(j); else localStorage.setItem(STORE_KEY, j); } catch (e) { /* in-memory only */ }
  }
};

const BOOK_COLORS = ['#7b2d8e', '#b5541c', '#1f6f78', '#8e2d4f', '#2d5a8e', '#5d7a1f', '#9a6b12', '#444a5e'];
function defaults() {
  return {
    version: 1,
    settings: {
      name: '', target: 16, theme: 'saffron', mode: 'auto',
      slots: ['Before 6:30 AM', 'Before 8 AM', 'Before 10 AM', 'Later'],
      countUpTo: 2,                 // rounds in slots 1..countUpTo go into the "Chanting before 8AM" column
      chantHeader: 'Chanting before 8AM',
      summaryRow: true,
      reminder: { on: false, time: '21:00', onlyMissing: true, asked: false },
      speakers: [
        { id: 'sp', name: 'Prabhupada', short: 'SP' },
        { id: 'gm', name: 'Guru Maharaj', short: 'RNSM' },
        { id: 'ot', name: 'Others', short: 'Others' }
      ]
    },
    books: [
      { id: 'sb', title: 'Srimad Bhagavatam', short: 'SB', color: BOOK_COLORS[0] },
      { id: 'bg', title: 'Bhagavad Gita As It Is', short: 'BG', color: BOOK_COLORS[1] },
      { id: 'cc', title: 'Chaitanya Charitamrita', short: 'CC', color: BOOK_COLORS[2] },
      { id: 'nod', title: 'Nectar of Devotion', short: 'NOD', color: BOOK_COLORS[3] }
    ],
    days: {}
  };
}
let S = Store.load();
if (!S || !S.settings) S = defaults();
(function migrate() {
  const d = defaults();
  S.settings = Object.assign({}, d.settings, S.settings);
  S.settings.reminder = Object.assign({}, d.settings.reminder, S.settings.reminder);
  S.books = S.books || d.books; S.days = S.days || {};
})();
let saveT = null;
const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => Store.save(S), 250); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(saveT); Store.save(S); } });
window.addEventListener('pagehide', () => Store.save(S));

const THEMES = {
  saffron: { name: 'Saffron Dawn', sw: ['#a8410d', '#d9a21b', '#fbe4cf'], pdf: [251, 228, 207] },
  tulsi:   { name: 'Tulsi', sw: ['#2d6a3e', '#c9a227', '#d9ecd9'], pdf: [217, 236, 217] },
  peacock: { name: 'Peacock', sw: ['#0e4a72', '#16a085', '#d5e8f3'], pdf: [213, 232, 243] },
  lotus:   { name: 'Lotus', sw: ['#9c2f63', '#e7952a', '#f6d9e6'], pdf: [246, 217, 230] },
  purple:  { name: 'Classic', sw: ['#4a1d5c', '#e8871e', '#efe4f3'], pdf: [233, 223, 240] }
};
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const st = S.settings, root = document.documentElement;
  if (!THEMES[st.theme]) st.theme = 'saffron';
  const dark = st.mode === 'dark' || (st.mode !== 'light' && mq && mq.matches);
  root.setAttribute('data-theme', st.theme); root.classList.toggle('dark', !!dark);
  const cs = getComputedStyle(root), bg = cs.getPropertyValue('--bg').trim(), nav = cs.getPropertyValue('--nav').trim();
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', bg);
  try { if (Bridge && Bridge.setSystemColors) Bridge.setSystemColors(bg, nav, !dark); } catch (e) {}
}
if (mq) (mq.addEventListener ? mq.addEventListener('change', applyTheme) : mq.addListener(applyTheme));
applyTheme();

const blankDay = () => ({ slept: '', woke: '', rounds: S.settings.slots.map(() => 0), reading: [], hearing: [], seva: '', notes: '' });
const getDay = k => { const d = S.days[k]; if (!d) return blankDay(); while (d.rounds.length < S.settings.slots.length) d.rounds.push(0); return d; };
function upd(k, fn) { const d = S.days[k] || (S.days[k] = blankDay()); fn(d); if (isEmpty(d)) delete S.days[k]; persist(); }
const isEmpty = d => !d || (!d.slept && !d.woke && !sum(d.rounds) && !d.reading.length && !d.hearing.length && !d.seva && !d.notes);
const totalRounds = d => sum(d.rounds);
const earlyRounds = d => sum(d.rounds.slice(0, S.settings.countUpTo));
const readMin = d => sum(d.reading.map(r => r.min));
const hearMin = d => sum(d.hearing.map(r => r.min));
const bookById = id => S.books.find(b => b.id === id) || { short: '?', title: 'Unknown', color: '#777' };
const spkById = id => S.settings.speakers.find(s => s.id === id) || { short: '?', name: 'Unknown' };
const dayStatus = k => { const d = S.days[k]; if (isEmpty(d)) return ''; return totalRounds(d) >= S.settings.target ? 'full' : 'part'; };

// ---------- UI shell ----------
let tab = 'home';
let cur = today();          // selected date on Home
let dashMon = mondayOf(today());
let expMon = mondayOf(addDays(today(), -7)); // default export: last completed week
if ((today().getDay() + 6) % 7 >= 5) expMon = mondayOf(today()); // on Sat/Sun default to current week

function toast(msg, ms = 2400) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, ms); }
function openSheet(html, onMount) { $('#sheetBody').innerHTML = html; $('#sheetWrap').hidden = false; onMount && onMount($('#sheetBody')); }
function closeSheet() { $('#sheetWrap').hidden = true; $('#sheetBody').innerHTML = ''; }
$('#sheetWrap').addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeSheet(); });
window.__sadhanaBack = () => { if (!$('#sheetWrap').hidden) { closeSheet(); return true; } if (tab !== 'home') { go('home'); return true; } return false; };

$$('.bottomnav button').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
$('#todayBtn').addEventListener('click', () => { cur = today(); dashMon = mondayOf(cur); go('home'); });
function go(t) { tab = t; $$('.bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.tab === t)); render(); window.scrollTo(0, 0); }
function render() {
  const v = $('#view');
  $('#topTitle').textContent = { home: 'Sadhana', dash: 'Dashboard', export: 'Weekly Card', settings: 'Settings' }[tab];
  $('#todayBtn').style.visibility = tab === 'home' || tab === 'dash' ? 'visible' : 'hidden';
  ({ home: renderHome, dash: renderDash, export: renderExport, settings: renderSettings })[tab](v);
}

// ---------- HOME ----------
// ---------- daily reminder ----------
function syncReminder(showMsg) {
  const r = S.settings.reminder; const [h, m] = r.time.split(':').map(Number);
  if (Bridge && Bridge.setReminder) { const msg = Bridge.setReminder(!!r.on, h, m, !!r.onlyMissing); if (showMsg) toast(msg); }
  else if (showMsg) toast(r.on ? 'Reminder saved — notifications work in the Android app' : 'Reminder off');
}
const notifAllowed = () => { try { return !Bridge || !Bridge.notificationsAllowed || Bridge.notificationsAllowed(); } catch (e) { return true; } };
function reminderBanner() {
  const r = S.settings.reminder;
  if (r.asked || r.on) return '';
  return `<div class="card banner"><div class="bell">🔔</div><div class="bt"><b>Daily reminder?</b><span class="muted">Get a gentle nudge at 9:00 PM to record your sadhana.</span>
    <div class="bb"><button class="chip" id="remOn">Turn on</button><button class="chip ghost" id="remNo">Not now</button></div></div></div>`;
}

function renderHome(v) {
  const k = keyOf(cur), d = getDay(k), mon = mondayOf(cur), tk = keyOf(today());
  const tot = totalRounds(d), target = S.settings.target;
  const sleptM = toMin(d.slept), wokeM = toMin(d.woke);
  let sleepDur = '';
  if (sleptM != null && wokeM != null) { let x = wokeM - sleptM; if (x <= 0) x += 1440; sleepDur = dur(x); }

  v.innerHTML = `${reminderBanner()}
  <div class="card" style="padding:8px 8px 4px">
    <div class="monthrow"><span class="m">${MON[cur.getMonth()]} ${cur.getFullYear()} ▾<input type="date" id="jump" value="${k}"></span>
      <span class="muted">${DOW[cur.getDay()]}${k === tk ? ' · Today' : ''}</span></div>
    <div class="datestrip">
      <button class="nav" id="prevW">${ICON.left}</button>
      <div class="days">${weekDays(mon).map(x => { const xk = keyOf(x); return `
        <button class="day ${xk === k ? 'sel' : ''} ${xk === tk ? 'today' : ''} ${x > today() ? 'future' : ''}" data-k="${xk}">
          <span>${MON3[x.getMonth()]}</span><b>${x.getDate()}</b><span>${DOW[x.getDay()].slice(0, 3)}</span><i class="dot ${dayStatus(xk)}"></i></button>`; }).join('')}</div>
      <button class="nav" id="nextW">${ICON.right}</button>
    </div>
  </div>

  <div class="card">
    <div class="card-h"><h3>Sleep</h3>${!d.slept && !d.woke ? `<button class="chip ghost" id="copySleep">Copy last entry</button>` : `<span class="muted">${sleepDur ? sleepDur + ' rest' : ''}</span>`}</div>
    <div class="grid2">
      <label class="tile"><div class="tile-row"><span class="ico">${ICON.bed}</span><span class="val ${d.slept ? '' : 'empty'}">${d.slept ? fmt12s(d.slept) : 'Set'}</span></div>
        <div class="lbl">Last night slept at</div><input type="time" id="slept" value="${d.slept}"></label>
      <label class="tile"><div class="tile-row"><span class="ico">${ICON.sun}</span><span class="val ${d.woke ? '' : 'empty'}">${d.woke ? fmt12s(d.woke) : 'Set'}</span></div>
        <div class="lbl">Woke up at</div><input type="time" id="woke" value="${d.woke}"></label>
    </div>
  </div>

  <div class="card">
    <div class="card-h"><h3>Chanting</h3><span class="total">Total ${tot}/${target}</span></div>
    <div class="progress"><i style="width:${Math.min(100, tot / target * 100)}%"></i></div>
    <div class="slots">${S.settings.slots.map((s, i) => `
      <div class="slot ${i < S.settings.countUpTo ? '' : ''}">
        <div class="sl">${esc(s)}</div>
        <button class="n ${d.rounds[i] ? '' : 'zero'}" data-set="${i}">${d.rounds[i] || 0}</button>
        <div class="pm"><button data-dec="${i}">−</button><button data-inc="${i}">+</button></div>
      </div>`).join('')}</div>
    <div class="sleepinfo"><span>${S.settings.chantHeader}: <b style="color:var(--ink)">${earlyRounds(d)}</b></span>${tot > target ? `<span style="color:var(--good);font-weight:700">+${tot - target} extra</span>` : tot === target && tot ? `<span style="color:var(--good);font-weight:700">Target met ✓</span>` : `<span>${Math.max(0, target - tot)} to go</span>`}</div>
  </div>

  <div class="card">
    <div class="card-h"><h3>Association</h3><span class="muted">${hearMin(d) ? dur(hearMin(d)) + ' heard' : 'Hearing'}</span></div>
    <div class="grid3">${S.settings.speakers.map(sp => { const n = d.hearing.filter(h => h.speaker === sp.id).length; return `
      <button class="assoc assoc-wrap" data-spk="${sp.id}"><span class="ico">${ICON.head}</span>${n ? `<i class="badge">${n}</i>` : ''}<span>${esc(sp.name)}</span></button>`; }).join('')}</div>
    ${d.hearing.length ? `<div class="entries">${d.hearing.map((h, i) => `
      <div class="entry"><span class="tag">${esc(spkById(h.speaker).short)}</span><span class="txt" data-edit-h="${i}">${esc(h.topic || 'Lecture')}</span><span class="mins">${dur(h.min)}</span><button class="x" data-del-h="${i}">×</button></div>`).join('')}</div>` : ''}
  </div>

  <div class="card">
    <div class="card-h"><h3>Book Reading</h3><button class="link-btn" id="addBook">+ Add Books</button></div>
    <div class="books">${S.books.map(b => `
      <button class="cover" style="background:linear-gradient(160deg,${b.color},${shade(b.color, -28)})" data-book="${b.id}"><b>${esc(b.short)}</b><small>${esc(b.title)}</small></button>`).join('')}
    </div>
    ${d.reading.length ? `<div class="entries">${d.reading.map((r, i) => `
      <div class="entry"><span class="tag">${esc(bookById(r.book).short)}</span><span class="txt" data-edit-r="${i}">${esc(r.ref || bookById(r.book).title)}</span><span class="mins">${dur(r.min)}</span><button class="x" data-del-r="${i}">×</button></div>`).join('')}</div>` : `<div class="empty-note">Tap a book to log what you read</div>`}
  </div>

  <div class="card">
    <div class="card-h"><h3>Seva</h3></div>
    <input type="text" id="seva" placeholder="e.g. Kitchen seva, book distribution…" value="${esc(d.seva)}">
    <div class="card-h" style="margin:14px 0 8px"><h3>Notes / Remarks</h3></div>
    <textarea id="notes" placeholder="Realisations, extra rounds, anything for your counsellor…">${esc(d.notes)}</textarea>
  </div>`;

  // events
  if ($('#remOn')) $('#remOn').onclick = () => { Object.assign(S.settings.reminder, { on: true, asked: true }); persist(); syncReminder(true); render(); };
  if ($('#remNo')) $('#remNo').onclick = () => { S.settings.reminder.asked = true; persist(); render(); toast('You can turn it on later in Settings'); };
  $$('.day', v).forEach(b => b.onclick = () => { cur = dateOf(b.dataset.k); render(); });
  $('#prevW').onclick = () => { cur = addDays(cur, -7); render(); };
  $('#nextW').onclick = () => { cur = addDays(cur, 7); render(); };
  $('#jump').onchange = e => { if (e.target.value) { cur = dateOf(e.target.value); render(); } };
  const tp = id => { const el = $('#' + id); el.addEventListener('click', () => { try { el.showPicker && el.showPicker(); } catch (e) {} });
    el.addEventListener('change', () => { upd(k, x => x[id] = el.value); render(); }); };
  tp('slept'); tp('woke');
  const cs = $('#copySleep'); if (cs) cs.onclick = () => {
    const prev = Object.keys(S.days).filter(x => x < k && (S.days[x].slept || S.days[x].woke)).sort().pop();
    if (!prev) return toast('No earlier sleep entry yet');
    upd(k, x => { x.slept = S.days[prev].slept; x.woke = S.days[prev].woke; }); render(); toast('Copied from ' + prev);
  };
  $$('[data-inc]', v).forEach(b => b.onclick = () => { const i = +b.dataset.inc; upd(k, x => x.rounds[i] = (x.rounds[i] || 0) + 1); render(); });
  $$('[data-dec]', v).forEach(b => b.onclick = () => { const i = +b.dataset.dec; upd(k, x => x.rounds[i] = Math.max(0, (x.rounds[i] || 0) - 1)); render(); });
  $$('[data-set]', v).forEach(b => b.onclick = () => roundsSheet(k, +b.dataset.set));
  $$('[data-spk]', v).forEach(b => b.onclick = () => hearingSheet(k, b.dataset.spk));
  $$('[data-edit-h]', v).forEach(b => b.onclick = () => { const i = +b.dataset.editH; hearingSheet(k, d.hearing[i].speaker, i); });
  $$('[data-del-h]', v).forEach(b => b.onclick = () => { const i = +b.dataset.delH; upd(k, x => x.hearing.splice(i, 1)); render(); });
  $$('[data-book]', v).forEach(b => b.onclick = () => readingSheet(k, b.dataset.book));
  $$('[data-edit-r]', v).forEach(b => b.onclick = () => { const i = +b.dataset.editR; readingSheet(k, d.reading[i].book, i); });
  $$('[data-del-r]', v).forEach(b => b.onclick = () => { const i = +b.dataset.delR; upd(k, x => x.reading.splice(i, 1)); render(); });
  $('#addBook').onclick = () => bookSheet();
  $('#seva').oninput = e => upd(k, x => x.seva = e.target.value);
  $('#notes').oninput = e => upd(k, x => x.notes = e.target.value);
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); const c = v => Math.max(0, Math.min(255, v + amt));
  return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function chipGroup(vals, sel, fmtFn = x => x) { return `<div class="chips">${vals.map(x => `<button type="button" data-v="${x}" class="${+sel === x ? 'on' : ''}">${fmtFn(x)}</button>`).join('')}</div>`; }
function wireChips(root, input) { $$('.chips button', root).forEach(b => b.onclick = () => { $$('.chips button', b.parentNode).forEach(o => o.classList.remove('on')); b.classList.add('on'); input.value = b.dataset.v; }); }

function roundsSheet(k, i) {
  const d = getDay(k);
  openSheet(`<h2>${esc(S.settings.slots[i])}</h2><div class="muted">Rounds chanted in this slot</div>
    ${chipGroup([0, 1, 2, 4, 6, 8, 10, 12, 16], d.rounds[i])}
    <label class="f">Or enter a number</label><input type="number" id="rn" inputmode="numeric" min="0" max="192" value="${d.rounds[i] || 0}">
    <button class="btn" id="ok">Save</button>`, r => {
    const inp = $('#rn', r); wireChips(r, inp);
    $('#ok', r).onclick = () => { upd(k, x => x.rounds[i] = Math.max(0, parseInt(inp.value) || 0)); closeSheet(); render(); };
  });
}

function hearingSheet(k, spk, idx) {
  const d = getDay(k); const e = idx != null ? d.hearing[idx] : { speaker: spk, min: 30, topic: '' };
  const sp = spkById(e.speaker);
  const recent = [...new Set(Object.values(S.days).flatMap(x => x.hearing.filter(h => h.speaker === e.speaker).map(h => h.topic)).filter(Boolean))].slice(-4);
  openSheet(`<h2>Hearing · ${esc(sp.name)}</h2><div class="muted">Shown as “${esc(sp.short)}” on the weekly card</div>
    <label class="f">Duration</label>${chipGroup([10, 15, 20, 30, 45, 60, 90, 120], e.min, dur)}
    <label class="f">Minutes</label><input type="number" id="hm" inputmode="numeric" value="${e.min}">
    <label class="f">Lecture topic (goes into Notes/Remark)</label><input type="text" id="ht" value="${esc(e.topic)}" placeholder="e.g. Cause of despondency">
    ${recent.length ? `<div class="chips" id="rec">${recent.map(t => `<button type="button" class="ghost">${esc(t)}</button>`).join('')}</div>` : ''}
    <button class="btn" id="ok">${idx != null ? 'Update' : 'Add'}</button>`, r => {
    wireChips(r, $('#hm', r));
    $$('#rec button', r).forEach(b => b.onclick = () => $('#ht', r).value = b.textContent);
    $('#ok', r).onclick = () => {
      const ent = { speaker: e.speaker, min: Math.max(0, parseInt($('#hm', r).value) || 0), topic: $('#ht', r).value.trim() };
      if (!ent.min) return toast('Enter minutes');
      upd(k, x => { if (idx != null) x.hearing[idx] = ent; else x.hearing.push(ent); }); closeSheet(); render();
    };
  });
}

function lastRef(bookId) {
  const ks = Object.keys(S.days).sort().reverse();
  for (const k of ks) { const r = S.days[k].reading.filter(x => x.book === bookId && x.ref).pop(); if (r) return r.ref; }
  return '';
}
function suggestNext(ref) { // "7.2" -> "7.3", "Ch 4" -> "Ch 5"
  const m = ref.match(/^(.*?)(\d+)(\D*)$/); return m ? m[1] + (parseInt(m[2]) + 1) + m[3] : '';
}
function readingSheet(k, bookId, idx) {
  const d = getDay(k); const b = bookById(bookId); const last = lastRef(bookId);
  const e = idx != null ? d.reading[idx] : { book: bookId, ref: '', min: 20 };
  const nxt = last ? suggestNext(last) : '';
  openSheet(`<h2>${esc(b.title)}</h2><div class="muted">Shown as “${esc(b.short)} ${esc(e.ref || '7.2')}” on the weekly card</div>
    <label class="f">Chapter / verse / section</label><input type="text" id="rr" value="${esc(e.ref)}" placeholder="e.g. 7.2 or Advent of Lord Chaitanya">
    ${idx == null && last ? `<div class="chips">${[last, nxt].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).map((t, i) => `<button type="button" class="ghost" data-ref="${esc(t)}">${i === 0 ? 'Same: ' : 'Next: '}${esc(t)}</button>`).join('')}</div>` : ''}
    <label class="f">Duration</label>${chipGroup([10, 15, 20, 30, 45, 60, 90], e.min, dur)}
    <label class="f">Minutes</label><input type="number" id="rm" inputmode="numeric" value="${e.min}">
    <button class="btn" id="ok">${idx != null ? 'Update' : 'Add'}</button>`, r => {
    wireChips(r, $('#rm', r));
    $$('[data-ref]', r).forEach(x => x.onclick = () => $('#rr', r).value = x.dataset.ref);
    $('#ok', r).onclick = () => {
      const ent = { book: bookId, ref: $('#rr', r).value.trim(), min: Math.max(0, parseInt($('#rm', r).value) || 0) };
      if (!ent.min) return toast('Enter minutes');
      upd(k, x => { if (idx != null) x.reading[idx] = ent; else x.reading.push(ent); }); closeSheet(); render();
    };
  });
}

function bookSheet(id) {
  const b = id ? S.books.find(x => x.id === id) : { title: '', short: '', color: BOOK_COLORS[S.books.length % BOOK_COLORS.length] };
  let color = b.color;
  openSheet(`<h2>${id ? 'Edit book' : 'Add a book'}</h2>
    <label class="f">Title</label><input type="text" id="bt" value="${esc(b.title)}" placeholder="e.g. Krishna Book">
    <label class="f">Short code (used on the card)</label><input type="text" id="bs" value="${esc(b.short)}" maxlength="8" placeholder="e.g. KB">
    <label class="f">Cover colour</label><div class="swatches">${BOOK_COLORS.map(c => `<button type="button" style="background:${c}" data-c="${c}" class="${c === color ? 'on' : ''}"></button>`).join('')}</div>
    <button class="btn" id="ok">${id ? 'Save' : 'Add book'}</button>
    ${id ? '<button class="btn danger" id="del">Remove book</button>' : ''}`, r => {
    $$('[data-c]', r).forEach(x => x.onclick = () => { color = x.dataset.c; $$('[data-c]', r).forEach(o => o.classList.toggle('on', o === x)); });
    $('#bt', r).oninput = e => { if (!id && !$('#bs', r)._t) $('#bs', r).value = e.target.value.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 4); };
    $('#bs', r).oninput = e => e.target._t = true;
    $('#ok', r).onclick = () => {
      const t = $('#bt', r).value.trim(), s = $('#bs', r).value.trim() || t.slice(0, 3).toUpperCase();
      if (!t) return toast('Enter a title');
      if (id) Object.assign(b, { title: t, short: s, color }); else S.books.push({ id: uid(), title: t, short: s, color });
      persist(); closeSheet(); render();
    };
    const del = $('#del', r); if (del) del.onclick = () => { S.books = S.books.filter(x => x.id !== id); persist(); closeSheet(); render(); };
  });
}

// ---------- DASHBOARD ----------
function renderDash(v) {
  const days = weekDays(dashMon), ks = days.map(keyOf);
  const logged = ks.map(k => S.days[k]).filter(d => !isEmpty(d));
  const target = S.settings.target;
  const rounds = ks.map(k => S.days[k] ? totalRounds(S.days[k]) : 0);
  const met = rounds.filter(r => r >= target).length;
  const avgT = arr => { const a = arr.filter(x => x != null); return a.length ? Math.round(sum(a) / a.length) : null; };
  const wakes = ks.map(k => S.days[k] ? toMin(S.days[k].woke) : null);
  const sleeps = ks.map(k => { const m = S.days[k] ? toMin(S.days[k].slept) : null; return m == null ? null : (m < 720 ? m + 1440 : m); });
  const mt = m => m == null ? '–' : fmt12s(`${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`);
  const rTot = sum(ks.map(k => S.days[k] ? readMin(S.days[k]) : 0));
  const hTot = sum(ks.map(k => S.days[k] ? hearMin(S.days[k]) : 0));

  // streak: consecutive days up to today (or yesterday if today not done) meeting target
  let streak = 0, dd = today();
  if (!(S.days[keyOf(dd)] && totalRounds(S.days[keyOf(dd)]) >= target)) dd = addDays(dd, -1);
  while (S.days[keyOf(dd)] && totalRounds(S.days[keyOf(dd)]) >= target) { streak++; dd = addDays(dd, -1); }
  let best = 0, run = 0; Object.keys(S.days).sort().reduce((prev, k) => {
    const ok = totalRounds(S.days[k]) >= target; const consec = prev && keyOf(addDays(dateOf(prev), 1)) === k;
    run = ok ? (consec ? run + 1 : 1) : 0; best = Math.max(best, run); return ok ? k : null; }, null);

  v.innerHTML = `
  <div class="weeknav"><button class="nav" id="pw">${ICON.left}</button><div class="w"><b>${weekLabel(dashMon)}</b><span class="muted">${rangeLabel(dashMon)}</span></div><button class="nav" id="nw">${ICON.right}</button></div>
  <div class="stats">
    <div class="stat"><div class="k">Rounds</div><div class="v">${sum(rounds)}</div><div class="s">avg ${logged.length ? (sum(rounds) / 7).toFixed(1) : 0}/day</div></div>
    <div class="stat"><div class="k">Target met</div><div class="v">${met}<span class="muted">/7</span></div><div class="s">${target} rounds/day</div></div>
    <div class="stat"><div class="k">Days logged</div><div class="v">${logged.length}<span class="muted">/7</span></div><div class="s">this week</div></div>
    <div class="stat"><div class="k">Avg wake-up</div><div class="v" style="font-size:16px">${mt(avgT(wakes))}</div></div>
    <div class="stat"><div class="k">Avg bedtime</div><div class="v" style="font-size:16px">${mt(avgT(sleeps))}</div></div>
    <div class="stat"><div class="k">Read · Heard</div><div class="v" style="font-size:16px">${dur(rTot)}</div><div class="s">${dur(hTot)} hearing</div></div>
  </div>
  <div class="card chart"><div class="card-h"><h3>Rounds per day</h3><span class="muted">target ${target}</span></div>${roundsChart(days, target)}
    <div class="legend"><span><i style="background:var(--brand-2)"></i>${esc(S.settings.chantHeader)}</span><span><i style="background:var(--saffron)"></i>Later</span></div></div>
  <div class="card chart"><div class="card-h"><h3>Sleep window</h3><span class="muted">bedtime → wake-up</span></div>${sleepChart(days)}</div>
  <div class="card chart"><div class="card-h"><h3>Reading & hearing</h3><span class="muted">minutes</span></div>${minutesChart(days)}
    <div class="legend"><span><i style="background:var(--c-read)"></i>Reading</span><span><i style="background:var(--c-hear)"></i>Hearing</span></div></div>
  <div class="card"><div class="card-h"><h3>Chanting streak</h3></div>
    <div class="streak"><span class="big">${streak}</span><div><b>day${streak === 1 ? '' : 's'} in a row</b><div class="muted">at ${target}+ rounds · best ${best}</div></div></div></div>
  <div class="card"><div class="card-h"><h3>Last 5 weeks</h3><span class="muted">rounds / day</span></div>${heatmap()}</div>`;
  $('#pw').onclick = () => { dashMon = addDays(dashMon, -7); render(); };
  $('#nw').onclick = () => { dashMon = addDays(dashMon, 7); render(); };
  $$('[data-go]', v).forEach(b => b.onclick = () => { cur = dateOf(b.dataset.go); go('home'); });
}

function roundsChart(days, target) {
  const W = 320, H = 150, L = 24, B = 20, T = 8, cw = (W - L - 4) / 7;
  const rs = days.map(x => S.days[keyOf(x)] || null);
  const max = Math.max(target + 4, ...rs.map(d => d ? totalRounds(d) : 0));
  const y = v => T + (H - T - B) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${W} ${H}">`;
  [0, Math.round(max / 2), max].forEach(g => s += `<line x1="${L}" x2="${W}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)"/><text x="${L - 4}" y="${y(g) + 3}" text-anchor="end">${g}</text>`);
  rs.forEach((d, i) => {
    const x = L + i * cw + cw * .2, w = cw * .6, e = d ? earlyRounds(d) : 0, t = d ? totalRounds(d) : 0;
    if (t) { s += `<rect x="${x}" y="${y(t)}" width="${w}" height="${y(e) - y(t)}" fill="var(--saffron)" rx="3"/><rect x="${x}" y="${y(e)}" width="${w}" height="${y(0) - y(e)}" fill="var(--brand-2)" rx="3"/>`;
      s += `<text x="${x + w / 2}" y="${y(t) - 3}" text-anchor="middle" style="fill:var(--ink);font-weight:700">${t}</text>`; }
    s += `<text x="${x + w / 2}" y="${H - 5}" text-anchor="middle">${DOW[days[i].getDay()].slice(0, 2)}</text>`;
  });
  s += `<line x1="${L}" x2="${W}" y1="${y(target)}" y2="${y(target)}" stroke="var(--good)" stroke-dasharray="4 3" stroke-width="1.5"/>`;
  return s + '</svg>';
}
function sleepChart(days) {
  // x axis: 8 PM (1200) .. 10 AM (2040) of the following morning
  const W = 320, rowH = 18, L = 30, top = 16, H = top + rowH * 7 + 4, x0 = 1200, x1 = 2040;
  const x = m => L + (W - L - 6) * (m - x0) / (x1 - x0);
  let s = `<svg viewBox="0 0 ${W} ${H}">`;
  [[1200, '8p'], [1320, '10p'], [1440, '12a'], [1560, '2a'], [1680, '4a'], [1800, '6a'], [1920, '8a'], [2040, '10a']].forEach(([m, l]) =>
    s += `<line x1="${x(m)}" x2="${x(m)}" y1="${top - 4}" y2="${H}" stroke="var(--line)"/><text x="${x(m)}" y="10" text-anchor="middle">${l}</text>`);
  days.forEach((dd, i) => {
    const d = S.days[keyOf(dd)], yy = top + i * rowH;
    s += `<text x="${L - 6}" y="${yy + 12}" text-anchor="end">${DOW[dd.getDay()].slice(0, 2)}</text>`;
    if (!d) return;
    let a = toMin(d.slept), b = toMin(d.woke);
    if (a != null && a < 720) a += 1440; if (b != null) b += 1440;
    if (a != null && b != null) s += `<rect x="${x(Math.max(x0, a))}" y="${yy + 3}" width="${Math.max(2, x(Math.min(x1, b)) - x(Math.max(x0, a)))}" height="${rowH - 6}" rx="6" fill="var(--brand-2)" opacity=".85"/>`;
    if (b != null) s += `<circle cx="${x(Math.min(x1, b))}" cy="${yy + rowH / 2}" r="4" fill="var(--saffron)"/>`;
  });
  return s + '</svg>';
}
function minutesChart(days) {
  const W = 320, H = 130, L = 28, B = 18, T = 8, cw = (W - L - 4) / 7;
  const vals = days.map(x => { const d = S.days[keyOf(x)]; return d ? [readMin(d), hearMin(d)] : [0, 0]; });
  const max = Math.max(60, ...vals.map(v => v[0] + v[1]));
  const y = v => T + (H - T - B) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${W} ${H}">`;
  [0, max].forEach(g => s += `<line x1="${L}" x2="${W}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)"/><text x="${L - 4}" y="${y(g) + 3}" text-anchor="end">${g}</text>`);
  vals.forEach(([r, h], i) => {
    const x = L + i * cw + cw * .2, w = cw * .6;
    if (r) s += `<rect x="${x}" y="${y(r)}" width="${w}" height="${y(0) - y(r)}" fill="var(--c-read)" rx="3"/>`;
    if (h) s += `<rect x="${x}" y="${y(r + h)}" width="${w}" height="${y(r) - y(r + h)}" fill="var(--c-hear)" rx="3"/>`;
    s += `<text x="${x + w / 2}" y="${H - 4}" text-anchor="middle">${DOW[days[i].getDay()].slice(0, 2)}</text>`;
  });
  return s + '</svg>';
}
function heatmap() {
  const start = addDays(mondayOf(today()), -28), target = S.settings.target;
  let h = '<div class="heat">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<div style="background:none;aspect-ratio:auto">${x}</div>`).join('');
  for (let i = 0; i < 35; i++) {
    const dd = addDays(start, i), k = keyOf(dd), d = S.days[k], r = d ? totalRounds(d) : 0;
    const a = r ? Math.min(1, .45 + .55 * r / target) : 1;
    const bg = r ? (r >= target ? 'var(--good)' : 'var(--accent)') : '';
    h += `<div data-go="${k}" style="${bg ? 'background:' + bg + ';color:#fff;font-weight:700;opacity:' + a.toFixed(2) : ''}${dd > today() ? ';opacity:.35' : ''}" title="${k}">${r || dd.getDate()}</div>`;
  }
  return h + '</div>';
}

// ---------- EXPORT ----------
function cardRows(mon) {
  const st = S.settings;
  return weekDays(mon).map(dd => {
    const d = S.days[keyOf(dd)];
    const dateCell = `${DOW[dd.getDay()]}\n${dd.getDate()}-${MON3[dd.getMonth()]}`;
    if (isEmpty(d)) return [dateCell, '', '', '', '', '', '', ''];
    const x = getDay(keyOf(dd));
    const early = earlyRounds(x), later = totalRounds(x) - early;
    const chant = String(early) + (later ? `\n(+${later} later)` : '');
    const rm = readMin(x);
    const reading = x.reading.length ? `${dur(rm)}\n${x.reading.map(r => `${bookById(r.book).short} ${r.ref}`.trim()).join('\n')}` : '-';
    const hm = hearMin(x);
    const shorts = [...new Set(x.hearing.map(h => spkById(h.speaker).short))];
    const hearing = x.hearing.length ? `${dur(hm)}\n${shorts.join(', ')}` : '-';
    const notes = [...x.hearing.filter(h => h.topic).map(h => `Lecture – ${h.topic}`), ...(totalRounds(x) > st.target ? [`Extra rounds - ${totalRounds(x) - st.target}`] : []), x.notes.trim()].filter(Boolean).join('\n');
    return [dateCell, fmt12(x.slept), fmt12(x.woke), chant, reading, hearing, x.seva || '', notes];
  });
}
function summaryRow(mon) {
  const ds = weekDays(mon).map(dd => S.days[keyOf(dd)]).filter(d => !isEmpty(d));
  if (!ds.length) return null;
  const avg = a => { a = a.filter(v => v != null); return a.length ? Math.round(sum(a) / a.length) : null; };
  const t = m => m == null ? '' : fmt12(`${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`);
  const sl = avg(ds.map(d => { const m = toMin(d.slept); return m == null ? null : (m < 720 ? m + 1440 : m); }));
  const wk = avg(ds.map(d => toMin(d.woke)));
  const early = sum(ds.map(earlyRounds));
  const all = sum(ds.map(totalRounds));
  return ['Week total\n/ average', t(sl) ? 'avg ' + t(sl) : '', t(wk) ? 'avg ' + t(wk) : '', `${early}` + (all > early ? `\n(${all} total)` : ''),
    dur(sum(ds.map(readMin))), dur(sum(ds.map(hearMin))), '', `${ds.filter(d => totalRounds(d) >= S.settings.target).length}/7 days at ${S.settings.target} rounds`];
}
const HEAD = () => ['Date', 'Last Night\nSlept at', 'Woke\nUp at', S.settings.chantHeader.replace(/ before /i, '\nbefore '), 'Reading SP\n(Minutes)', 'Hearing (Minutes)', 'Seva', 'Notes/Remark'];

function renderExport(v) {
  const rows = cardRows(expMon), sr = S.settings.summaryRow ? summaryRow(expMon) : null;
  v.innerHTML = `
  <div class="weeknav"><button class="nav" id="pw">${ICON.left}</button><div class="w"><b>${weekLabel(expMon)}</b><span class="muted">${rangeLabel(expMon)}</span></div><button class="nav" id="nw">${ICON.right}</button></div>
  <div class="card">
    <div class="card-h"><h3>Sadhana Card preview</h3><span class="muted">${weekDays(expMon).filter(d => !isEmpty(S.days[keyOf(d)])).length}/7 days logged</span></div>
    <div class="preview"><table><tr>${HEAD().map(h => `<th>${esc(h)}</th>`).join('')}</tr>
      ${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
      ${sr ? `<tr>${sr.map(c => `<td style="background:rgb(${THEMES[S.settings.theme].pdf.join(',')});font-weight:600">${esc(c)}</td>`).join('')}</tr>` : ''}</table></div>
    <div class="row2">
      <button class="btn" id="savePdf">${ICON.pdf} Save PDF</button>
      <button class="btn sec" id="sharePdf">${ICON.share} Share</button>
    </div>
    <button class="btn sec" id="monthPdf">Whole month (${MON[expMon.getMonth()]}) as one PDF</button>
  </div>
  <div class="card">
    <div class="card-h"><h3>Card options</h3></div>
    <label class="f">Name on card</label><input type="text" id="nm" value="${esc(S.settings.name)}" placeholder="Your name (optional)">
    <div class="sw"><span>Weekly total / average row</span><button class="toggle ${S.settings.summaryRow ? 'on' : ''}" id="sumT"></button></div>
    <div class="muted">Chanting column counts rounds from the first ${S.settings.countUpTo} slot(s) — change in Settings.</div>
  </div>`;
  $('#pw').onclick = () => { expMon = addDays(expMon, -7); render(); };
  $('#nw').onclick = () => { expMon = addDays(expMon, 7); render(); };
  $('#nm').oninput = e => { S.settings.name = e.target.value; persist(); };
  $('#sumT').onclick = () => { S.settings.summaryRow = !S.settings.summaryRow; persist(); render(); };
  $('#savePdf').onclick = () => exportPdf([expMon], false);
  $('#sharePdf').onclick = () => exportPdf([expMon], true);
  $('#monthPdf').onclick = () => {
    const m = expMon.getMonth(), y = expMon.getFullYear(); const mons = [];
    let d = mondayOf(new Date(y, m, 1)); if (d.getMonth() !== m) d = addDays(d, 7);
    while (d.getMonth() === m) { mons.push(d); d = addDays(d, 7); }
    exportPdf(mons, false);
  };
}

function buildPdf(mons) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const widths = [62, 55, 44, 58, 60, 84, 80, 165]; const scale = (W - 80) / sum(widths);
  mons.forEach((mon, pi) => {
    if (pi) doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(0);
    doc.text('Sadhana Card', W / 2, 48, { align: 'center' });
    doc.setFontSize(11.5); doc.text(`Month: ${weekLabel(mon)}`, W / 2, 66, { align: 'center' });
    if (S.settings.name) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(`Name: ${S.settings.name}`, 40, 66); }
    const body = cardRows(mon); const sr = S.settings.summaryRow ? summaryRow(mon) : null;
    if (sr) body.push(sr);
    doc.autoTable({
      startY: 74, margin: { left: 40, right: 40 }, head: [HEAD()], body, theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.6, textColor: 20, lineColor: 0, lineWidth: 0.6, cellPadding: { top: 4, bottom: 6, left: 4, right: 3 }, valign: 'top', minCellHeight: 34 },
      headStyles: { fillColor: 255, textColor: 0, fontStyle: 'bold', minCellHeight: 38 },
      columnStyles: Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w * scale }])),
      didParseCell: h => {
        if (h.section !== 'body') return;
        const isSum = sr && h.row.index === body.length - 1;
        if (isSum) { h.cell.styles.fillColor = THEMES[S.settings.theme].pdf; h.cell.styles.fontStyle = 'bold'; h.cell.styles.minCellHeight = 28; }
        else h.cell.styles.fillColor = h.row.index % 2 === 0 ? 242 : 255;
        if (h.column.index === 0) h.cell.styles.fontStyle = 'bold';
      }
    });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(140);
    doc.text(`${rangeLabel(mon)}`, 40, doc.internal.pageSize.getHeight() - 24);
  });
  return doc;
}
function fileName(mons) {
  const m = mons[0];
  return mons.length > 1 ? `Sadhana card ${MON3[m.getMonth()]} ${m.getFullYear()}.pdf` : `Sadhana card ${MON3[m.getMonth()]} w${Math.ceil(m.getDate() / 7)}.pdf`;
}
function exportPdf(mons, share) {
  try {
    const doc = buildPdf(mons), name = fileName(mons);
    if (Bridge && Bridge.saveFile) {
      const b64 = doc.output('datauristring').split(',')[1];
      toast(Bridge.saveFile(b64, name, 'application/pdf', !!share) || 'Saved');
    } else if (share && navigator.canShare) {
      const f = new File([doc.output('blob')], name, { type: 'application/pdf' });
      if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: name }).catch(() => {}); else doc.save(name);
    } else { doc.save(name); toast('Downloaded ' + name); }
  } catch (e) { toast('Could not create PDF: ' + e.message, 4000); console.error(e); }
}
window.__sadhanaBuildPdf = (monKey) => buildPdf([dateOf(monKey)]); // used by tests

// ---------- SETTINGS ----------
function renderSettings(v) {
  const st = S.settings;
  v.innerHTML = `
  <div class="card"><div class="card-h"><h3>Appearance</h3><span class="muted">${THEMES[st.theme].name}</span></div>
    <div class="themes">${Object.entries(THEMES).map(([id, t]) => `
      <button class="theme-opt ${st.theme === id ? 'on' : ''}" data-theme-id="${id}"><span class="sw3">${t.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>${t.name}</button>`).join('')}</div>
    <div class="seg">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([m, l]) => `<button data-mode="${m}" class="${st.mode === m ? 'on' : ''}">${l}</button>`).join('')}</div>
  </div>
  <div class="card"><div class="card-h"><h3>Daily reminder</h3><button class="toggle ${st.reminder.on ? 'on' : ''}" id="remT"></button></div>
    <div class="muted">A notification to record your sadhana each day.</div>
    ${st.reminder.on ? `
    <label class="f">Remind me at</label><input type="time" id="remTime" value="${st.reminder.time}" style="width:100%;background:var(--tile);border:1px solid var(--line);border-radius:12px;padding:10px 12px">
    <div class="sw"><span>Skip if today is already logged</span><button class="toggle ${st.reminder.onlyMissing ? 'on' : ''}" id="remM"></button></div>
    ${notifAllowed() ? '' : `<div class="warn-box">Notifications are blocked for Sadhana. <button class="link-btn" id="remFix">Allow in settings</button></div>`}
    <button class="btn sec" id="remTest">Send a test notification</button>` : ''}
  </div>
  <div class="card"><div class="card-h"><h3>Profile & goal</h3></div>
    <label class="f">Your name (printed on the card)</label><input type="text" id="nm" value="${esc(st.name)}">
    <label class="f">Daily rounds target</label><input type="number" id="tg" inputmode="numeric" value="${st.target}">
  </div>
  <div class="card"><div class="card-h"><h3>Chanting time slots</h3></div>
    ${st.slots.map((s, i) => `<div class="list-item"><input type="text" data-slot="${i}" value="${esc(s)}"></div>`).join('')}
    <label class="f">Card column heading</label><input type="text" id="ch" value="${esc(st.chantHeader)}">
    <label class="f">That column counts rounds from slots</label>
    <select id="cu">${st.slots.map((s, i) => `<option value="${i + 1}" ${st.countUpTo === i + 1 ? 'selected' : ''}>1–${i + 1} (up to “${esc(s)}”)</option>`).join('')}</select>
    <div class="muted" style="margin-top:6px">Rounds in later slots appear as “(+N later)”.</div>
  </div>
  <div class="card"><div class="card-h"><h3>Hearing — speakers</h3></div>
    <div class="muted" style="margin-bottom:8px">Name · short label used on the card</div>
    ${st.speakers.map((s, i) => `<div class="list-item"><input type="text" data-spn="${i}" value="${esc(s.name)}"><input class="short" type="text" data-sps="${i}" value="${esc(s.short)}"><button class="x" data-spx="${i}">×</button></div>`).join('')}
    <button class="btn sec" id="addSp">+ Add speaker</button>
  </div>
  <div class="card"><div class="card-h"><h3>Books</h3></div>
    ${S.books.map(b => `<div class="entry" style="margin-bottom:6px"><span class="tag" style="background:${b.color};color:#fff">${esc(b.short)}</span><span class="txt">${esc(b.title)}</span><button class="link-btn" data-eb="${b.id}">Edit</button></div>`).join('')}
    <button class="btn sec" id="addB">+ Add book</button>
  </div>
  <div class="card"><div class="card-h"><h3>Backup</h3></div>
    <div class="muted">Your data stays on this phone. Save a backup file now and then (e.g. to Drive) so you never lose it.</div>
    <div class="row2"><button class="btn sec" id="bk">Save backup</button><button class="btn sec" id="rs">Restore</button></div>
    <input type="file" id="rf" accept="application/json,.json" hidden>
    <button class="btn sec" id="csv">Export all entries (CSV)</button>
  </div>
  <div class="muted" style="text-align:center;margin:8px 0 16px">Sadhana Tracker · ${Object.keys(S.days).length} days logged</div>`;

  $$('[data-theme-id]', v).forEach(b => b.onclick = () => { st.theme = b.dataset.themeId; persist(); applyTheme(); render(); });
  $$('[data-mode]', v).forEach(b => b.onclick = () => { st.mode = b.dataset.mode; persist(); applyTheme(); render(); });
  $('#nm').oninput = e => { st.name = e.target.value; persist(); };
  $('#remT').onclick = () => { st.reminder.on = !st.reminder.on; st.reminder.asked = true; persist(); syncReminder(true); render(); };
  if ($('#remTime')) $('#remTime').onchange = e => { if (e.target.value) { st.reminder.time = e.target.value; persist(); syncReminder(false); toast('Reminder at ' + fmt12s(e.target.value)); } };
  if ($('#remM')) $('#remM').onclick = () => { st.reminder.onlyMissing = !st.reminder.onlyMissing; persist(); syncReminder(false); render(); };
  if ($('#remFix')) $('#remFix').onclick = () => Bridge && Bridge.openNotificationSettings && Bridge.openNotificationSettings();
  if ($('#remTest')) $('#remTest').onclick = () => toast(Bridge && Bridge.testReminder ? Bridge.testReminder() : 'Notifications work in the Android app');
  $('#tg').oninput = e => { const n = parseInt(e.target.value); if (n > 0) { st.target = n; persist(); } };
  $$('[data-slot]', v).forEach(i => i.oninput = () => { st.slots[+i.dataset.slot] = i.value; persist(); });
  $('#ch').oninput = e => { st.chantHeader = e.target.value || 'Chanting'; persist(); };
  $('#cu').onchange = e => { st.countUpTo = +e.target.value; persist(); };
  $$('[data-spn]', v).forEach(i => i.oninput = () => { st.speakers[+i.dataset.spn].name = i.value; persist(); });
  $$('[data-sps]', v).forEach(i => i.oninput = () => { st.speakers[+i.dataset.sps].short = i.value; persist(); });
  $$('[data-spx]', v).forEach(b => b.onclick = () => { if (st.speakers.length <= 1) return; st.speakers.splice(+b.dataset.spx, 1); persist(); render(); });
  $('#addSp').onclick = () => { st.speakers.push({ id: uid(), name: 'New speaker', short: 'NEW' }); persist(); render(); };
  $$('[data-eb]', v).forEach(b => b.onclick = () => bookSheet(b.dataset.eb));
  $('#addB').onclick = () => bookSheet();
  $('#bk').onclick = () => saveText(JSON.stringify(S, null, 1), `sadhana-backup-${keyOf(today())}.json`, 'application/json');
  $('#rs').onclick = () => $('#rf').click();
  $('#rf').onchange = e => {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const j = JSON.parse(r.result); if (!j.days || !j.settings) throw new Error('not a Sadhana backup');
      const n = Object.keys(j.days).length; S = j; migrateAfterRestore(); Store.save(S); toast(`Restored ${n} days`); render(); } catch (err) { toast('Restore failed: ' + err.message, 4000); } };
    r.readAsText(f);
  };
  $('#csv').onclick = () => {
    const hdr = ['Date', 'Slept', 'Woke', ...st.slots.map(s => 'Rounds ' + s), 'Total rounds', 'Reading min', 'Reading', 'Hearing min', 'Hearing', 'Seva', 'Notes'];
    const q = s => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
    const lines = Object.keys(S.days).sort().map(k => { const d = getDay(k); return [k, d.slept, d.woke, ...st.slots.map((_, i) => d.rounds[i] || 0), totalRounds(d), readMin(d),
      d.reading.map(r => `${bookById(r.book).short} ${r.ref} (${r.min}m)`).join('; '), hearMin(d), d.hearing.map(h => `${spkById(h.speaker).short}: ${h.topic} (${h.min}m)`).join('; '), d.seva, d.notes].map(q).join(','); });
    saveText([hdr.map(q).join(','), ...lines].join('\n'), `sadhana-${keyOf(today())}.csv`, 'text/csv');
  };
}
function migrateAfterRestore() { const d = defaults(); S.settings = Object.assign({}, d.settings, S.settings); S.books = S.books || d.books; applyTheme(); }
function saveText(text, name, mime) {
  if (Bridge && Bridge.saveFile) {
    const b64 = btoa(unescape(encodeURIComponent(text)));
    toast(Bridge.saveFile(b64, name, mime, false) || 'Saved');
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Downloaded ' + name);
  }
}

window.__sadhanaFlush = () => { clearTimeout(saveT); Store.save(S); };
if (S.settings.reminder.on) syncReminder(false); // re-arm on every launch
window.__sadhanaResume = () => { if (!document.querySelector('input:focus,textarea:focus')) render(); };
// test hooks
window.__sadhana = { get state() { return S; }, set state(v) { S = v; migrateAfterRestore(); render(); }, render, go };
render();
})();
