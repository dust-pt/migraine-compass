/* Migraine Compass — PWA that mirrors the Figma prototype. All entries stay on the device (localStorage). */
'use strict';

// ---------- Options (same as Figma) ----------
const OPT = {
  started: ['Now', '1 h ago', 'Earlier today', 'Yesterday', 'Another day'],
  ongoing: ['Yes', 'No'],
  routine: ['Irregular schedule', 'Skipped exercise', 'More exercise', 'Sun exposure', 'Trip', 'Late night', 'Menstruation', 'No change'],
  food: ['Skipped a meal', 'Late meal', 'Coffee', 'Alcohol', 'Chocolate', 'Aged cheese', 'Processed food', 'Little water', 'Nothing unusual'],
  feelings: ['Stressed', 'Anxious', 'Sad', 'Irritable', 'Tired', 'Calm', 'Happy', 'Excited'],
  medication: ['Took medication', 'No medication'],
  helped: ['Dark room', 'Rest', 'Sleep']
};
const EXTRA = {
  routine: [],
  food: ['Red wine', 'Citrus fruit', 'Cured meats', 'Artificial sweeteners', 'Energy drink', 'Fasting'],
  feelings: ['Nauseous', 'Dizzy', 'Sensitive to light', 'Sensitive to noise', 'Aura', 'Neck pain', 'Overwhelmed']
};
const SECTION = { food: 'Food and drink', feelings: 'How are you feeling?', routine: 'Any change in routine?' };
const APP_URL = 'https://migraine-compass.pages.dev';
const GROUPS = ['routine', 'food', 'feelings'];
const UNITS = ['min', 'hours', 'days'];
const FEEDBACK_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSfG9RKKRzTS_LGPfTIUviv5vzTiU6vG5_XAGU24vawXJuzG4g/viewform';
const EVAL_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLScND-Njh00GLtgika9plVlZOSR3kby6mKCc_xpSPN4hRtWqLA/viewform';
const SINGLE = ['started', 'ongoing', 'medication', 'unit'];
const EXCLUSIVE = { 'No change': 'routine', 'Nothing unusual': 'food' };

// ---------- Storage ----------
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const logs = () => read('mc.logs', []).sort((a, b) => b.start.localeCompare(a.start));
const saveLogs = v => write('mc.logs', v);
const settings = () => {
  const s = Object.assign({ theme: 'auto', extras: {}, custom: {}, hidden: {}, invite: 'new' }, read('mc.settings', {}));
  for (const k of ['extras', 'custom', 'hidden']) for (const g of GROUPS) s[k][g] = s[k][g] || [];
  // older versions had a Settings switch for Menstruation: keep the person's choice as a hidden option
  if (s.menstruation === false && !s.hidden.routine.includes('Menstruation')) s.hidden.routine.push('Menstruation');
  delete s.menstruation;
  // older versions kept the person's own options inside "extras": move them to "custom"
  for (const g of ['food', 'feelings']) for (const o of s.extras[g] || []) if (!EXTRA[g].includes(o) && !s.custom[g].includes(o)) s.custom[g].push(o);
  return s;
};
const saveSettings = patch => write('mc.settings', Object.assign(settings(), patch));
// Options shown in a section: base list (minus the ones removed) plus extras the person added ("Nothing unusual" stays last)
function optionsFor(g) {
  const st = settings(), hid = st.hidden[g] || [], base = OPT[g].filter(o => !hid.includes(o)), on = st.extras[g] || [];
  const extra = [...EXTRA[g], ...st.custom[g]].filter(x => on.includes(x)); // same order as in Settings
  const last = o => o === 'Nothing unusual' || o === 'No change';
  return [...base.filter(o => !last(o)), ...extra.filter(o => !base.includes(o)), ...base.filter(last)];
}
const toHours = (v, u) => u === 'min' ? v / 60 : u === 'days' ? v * 24 : v;
const fmtDur = h => h < 1 ? `${Math.round(h * 60)} min` : h >= 24 ? TX.days(Math.round(h / 24 * 10) / 10) : `${Math.round(h * 10) / 10} h`;
function applyTheme() {
  const t = settings().theme;
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#111A1B' : '#F4F7F7';
}
applyTheme();
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------- State ----------
const blankDraft = () => ({ started: 'Now', date: new Date(Date.now() - 2 * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10), time: '12:00', intensity: 7, ongoing: 'Yes', durValue: 4, unit: 'hours', routine: [], food: [], feelings: [],
  medication: null, helped: [], note: '', auto: null });
const S = { screen: 'home', draft: blankDraft(), period: '6m', sum: null, editing: false, month: null, end: null, openMig: null, lastOpen: false, editG: null };

// ---------- Helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
const hm = min => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const localISO = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const dayISO = d => localISO(d).slice(0, 10);
const startFrom = (opt, date, time) => {
  if (opt === 'Another day' && date) { // a past migraine: chosen day and time, never in the future
    const d = new Date(`${date}T${time || '12:00'}`);
    return localISO(isNaN(d) || d > new Date() ? new Date() : d);
  }
  const d = new Date();
  if (opt === '1 h ago') d.setHours(d.getHours() - 1);
  if (opt === 'Earlier today') d.setHours(Math.max(0, d.getHours() - 4));
  if (opt === 'Yesterday') d.setTime(d.getTime() - DAY);
  return localISO(d);
};
const toast = msg => {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
};
const chip = (g, l, on) => `<button class="chip" data-a="chip" data-g="${g}" data-v="${esc(l)}" aria-pressed="${on}">${esc(L(l))}</button>`;
const chips = (g, list, sel) => `<div class="chips">${list.map(l => chip(g, l, Array.isArray(sel) ? sel.includes(l) : sel === l)).join('')}</div>`;

function nav(active) {
  const items = [['home', 'Home'], ['history', 'History'], ['doctor', 'Summary']];
  return `<nav class="tabs">${items.map(([id, lb]) =>
    `<button data-a="go" data-v="${id}" ${id === active ? 'aria-current="page"' : ''}>${L(lb)}</button>`).join('')}</nav>`;
}

// ---------- Automatic data ----------
// Sleep (smartwatch) and screen time are sample data; weather is real when location is allowed.
function sampleAuto() {
  const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
  return { sleepMin: rnd(280, 460), screenMin: rnd(180, 480), weather: null };
}
// Weather change between the day before and the day the migraine started (works for past days too)
async function fetchWeather(day = new Date()) {
  try {
    const pos = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { timeout: 6000, maximumAge: 600000 }));
    const { latitude: la, longitude: lo } = pos.coords;
    const end = dayISO(day), start = dayISO(new Date(day.getTime() - DAY));
    const old = Date.now() - day.getTime() > 80 * DAY; // the forecast API keeps about 3 months; older days come from the archive
    const host = old ? 'archive-api.open-meteo.com/v1/archive' : 'api.open-meteo.com/v1/forecast';
    const u = `https://${host}?latitude=${la}&longitude=${lo}&daily=temperature_2m_mean,precipitation_sum&start_date=${start}&end_date=${end}&timezone=auto`;
    const j = await (await fetch(u)).json();
    const [y, t] = j.daily.temperature_2m_mean; const rain = j.daily.precipitation_sum[1] > 0.2;
    const diff = Math.round(t - y);
    return `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff)} °C${rain ? ', ' + L('rain') : ''}`;
  } catch { return null; }
}
async function loadAuto(force) {
  const d = S.draft; if (d.auto && !force) return;
  if (!d.auto) d.auto = sampleAuto();
  d.auto.weather = null; render();
  const w = await fetchWeather(new Date(startFrom(d.started, d.date, d.time)));
  d.auto.weather = w || L('Location off');
  if (S.screen === 'log1') render();
}

// ---------- Analysis ----------
function factorsOf(l) {
  const f = [...l.routine, ...l.food, ...l.feelings].filter(x => !['No change', 'Nothing unusual', 'Calm', 'Happy', 'Excited'].includes(x));
  if (l.auto && l.auto.sleepMin < 360) f.unshift('Slept under 6 h');
  return f;
}
function topFactors(list) {
  const c = {}; list.forEach(l => factorsOf(l).forEach(f => c[f] = (c[f] || 0) + 1));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
const inPeriod = (all, p) => {
  const now = new Date();
  const cut = p === '30d' ? new Date(now - 30 * DAY) : p === '6m' ? new Date(now.getFullYear(), now.getMonth() - 5, 1) : new Date(0);
  return all.filter(l => new Date(l.start) >= cut);
};
const fmtMonth = d => d.toLocaleDateString(LOC, { month: 'short' }).replace('.', '');
function stats(all) {
  const list = inPeriod(all, '6m');
  if (!list.length) return null;
  const ints = list.map(l => l.intensity).sort((a, b) => a - b);
  const durs = list.map(l => l.durationH).filter(Boolean).sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  const helped = {}; list.forEach(l => (l.helped || []).forEach(h => helped[h] = (helped[h] || 0) + 1));
  const first = new Date(list[list.length - 1].start), last = new Date(list[0].start);
  return {
    period: `${fmtMonth(first)} – ${fmtMonth(last)} ${last.getFullYear()}`,
    count6m: list.length, last30: inPeriod(all, '30d').length,
    intensityRange: [q(ints, .2), q(ints, .8)],
    durationRangeHours: durs.length ? [q(durs, .2), q(durs, .8)] : null,
    medicationTaken: list.filter(l => l.medication === 'Took medication').length,
    topFactors: topFactors(list).slice(0, 4).map(([factor, times]) => ({ factor: L(factor), times })),
    helped: Object.entries(helped).sort((a, b) => b[1] - a[1]).map(([what, times]) => ({ what: L(what), times }))
  };
}
function localSummary(st) {
  const [a, b] = st.intensityRange, d = st.durationRangeHours;
  const along = st.topFactors.map((f, i) => `${i ? f.factor.charAt(0).toLowerCase() + f.factor.slice(1) : f.factor} (${f.times}×)`).join(', ');
  return {
    title: `${L('Migraine summary')} · ${st.period}`,
    frequency: TX.sumFreq(st.count6m, st.last30),
    intensity: TX.sumInt(a === b ? a : `${a}–${b}`, d ? (d[0] === d[1] ? d[0] : `${d[0]}–${d[1]}`) : null),
    alongside: along ? along + '.' : L('Nothing logged alongside yet.'),
    questions: '', ai: false
  };
}

// Back of the flip card: how long each migraine in one month lasted
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const latestMonth = all => (all[0] ? all[0].start.slice(0, 7) : monthKey(new Date()));
// What was logged for one migraine (shown under its row)
function migDetail(l) {
  const time = new Date(l.start).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' });
  const tags = list => `<div class="mini">${list.map(x => `<span>${esc(L(x))}</span>`).join('')}</div>`;
  const groups = [
    ['Routine', [...(l.auto && l.auto.sleepMin < 360 ? ['Slept under 6 h'] : []), ...(l.routine || []).filter(x => x !== 'No change')]],
    ['Food and drink', (l.food || []).filter(x => x !== 'Nothing unusual')],
    ['Feelings', l.feelings || []],
    ['Medication taken', l.medication ? [l.medication] : []],
    ['What helped', l.helped || []]
  ].filter(([, v]) => v.length);
  const a = l.auto || {};
  const weather = a.weather && a.weather !== L('Location off') ? a.weather : L('no data');
  const facts = `<div class="dfacts"><div><small>${L('Sleep the night before')}</small><b>${a.sleepMin ? hm(a.sleepMin) : L('no data')}</b></div>
    <div><small>${L('Weather change that day')}</small><b>${esc(weather)}</b></div></div>`;
  return `<div class="mdetail"><p class="small muted">${esc(TX.detailHead(time, l.intensity))}</p>${facts}
    ${groups.map(([g, v]) => `<p class="mlabel">${L(g)}</p>${tags(v)}`).join('') || `<p class="small muted">${L('Nothing else logged.')}</p>`}
    ${l.note ? `<p class="mlabel">${L('Note (optional)').replace(/ \(.*\)/, '')}</p><p class="small">${esc(l.note)}</p>` : ''}</div>`;
}
function monthDetail(key) {
  const [y, m] = key.split('-').map(Number);
  const title = new Date(y, m - 1, 1).toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
  const list = logs().filter(l => l.start.startsWith(key)).reverse();
  const maxH = Math.max(1, ...list.map(l => l.durationH || 0));
  const rows = list.map(l => {
    const day = cap(new Date(l.start).toLocaleDateString(LOC, { weekday: 'short', day: 'numeric' }).replace(/\./g, ''));
    const h = l.durationH;
    const open = S.openMig === l.id;
    return `<div class="mig${open ? ' open' : ''}"><button class="drow" data-a="mig" data-v="${l.id}" aria-expanded="${open}"><span class="dday">${esc(day)}</span>
      <span class="dbar">${h ? `<i style="width:${Math.max(4, Math.round(h / maxH * 100))}%"></i>` : ''}</span>
      <b>${h ? esc(fmtDur(h)) : `<span class="muted small">${L(l.ongoing === 'Yes' ? 'ongoing' : 'not recorded')}</span>`}</b><span class="chev">›</span></button>
      ${open ? migDetail(l) : ''}</div>`;
  }).join('');
  return `<div class="dhead"><p class="label" style="margin:0">${L('Duration of each migraine')}</p>
      <button class="textlink small" style="margin:0" data-a="monthBack">${L('‹ All months')}</button></div>
    <p class="big" style="margin:4px 0 4px">${esc(cap(title))}</p>
    ${list.length ? `<p class="note" style="margin:0 0 6px">${L('Tap a migraine to see what you logged.')}</p>` : ''}
    ${rows || `<p class="muted">${L('No migraines logged this month.')}</p>`}`;
}

// Invite people to the evaluation form once they have logged 3 migraines of their own (sample data does not count)
const showInvite = all => settings().invite === 'new' && all.filter(l => !l.demo).length >= 3;
// Share the app: the phone's own share sheet when there is one, otherwise a few direct links
const shareText = () => L('I use Migraine Compass to log my migraines. Try it:');
function shareSheet() {
  const t = encodeURIComponent(shareText() + ' ' + APP_URL);
  return `<div class="card sharecard"><div class="dhead"><p class="label" style="margin:0">${L('Share the app')}</p>
      <button class="textlink small" style="margin:0" data-a="shareClose">${L('Close')}</button></div>
    <div class="sharegrid">
      <a class="btn outline" href="https://wa.me/?text=${t}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn outline" href="mailto:?subject=${encodeURIComponent('Migraine Compass')}&body=${t}">${L('Email')}</a>
      <a class="btn outline" href="sms:?&body=${t}">SMS</a>
      <button class="btn outline" data-a="shareCopy">${L('Copy link')}</button></div>
    <p class="note">${L('Only the link is shared, never your entries.')}</p></div>`;
}
const elapsedH = l => Math.max(0.25, (Date.now() - new Date(l.start).getTime()) / 36e5);
// Pick a readable value and unit for a number of hours
const toValUnit = h => h < 1 ? [Math.max(5, Math.round(h * 60 / 5) * 5), 'min'] : h < 48 ? [Math.round(h), 'hours'] : [Math.round(h / 24), 'days'];

// ---------- Screens ----------
const screens = {
  home() {
    const all = logs(), last = all[0];
    const month = all.filter(l => l.start.startsWith(monthKey(new Date()))).length;
    const lastTxt = last ? [new Date(last.start).toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''),
      TX.intensity(last.intensity), last.durationH ? TX.about(fmtDur(last.durationH)) : null].filter(Boolean).join(' · ') : L('Nothing logged yet');
    return `<div class="screen">
      <div class="brand"><span>Migraine Compass</span><span class="toplinks"><button class="textlink small" style="margin:0" data-a="share">${L('Share')}</button><button class="textlink small" style="margin:0" data-a="go" data-v="settings">${L('Settings')}</button></span></div>
      ${S.share ? shareSheet() : ''}
      <h1>${L('How are you today?')}</h1>
      ${all.filter(l => l.ongoing === 'Yes').map(l => `<div class="card ongoing"><div><p class="label" style="margin-bottom:4px">${L('Migraine in progress')}</p>
        <p>${esc(TX.since(new Date(l.start).toLocaleString(LOC, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ''), fmtDur(elapsedH(l)).replace(' ', '\u00a0')))}</p></div>
        <button class="btn small-btn" data-a="endStart" data-v="${l.id}">${L('It ended')}</button></div>`).join('')}
      <button class="hero" data-a="start"><b>${L('Log a migraine')}</b><span>${L('Three quick steps: when and routine, food and feelings, what helped.')}</span><small class="privacy">${L('Your entries are not saved in the cloud.')}</small><i>${L('Start ›')}</i></button>
      ${showInvite(all) ? `<div class="card invite"><p class="label">${L('Thank you for trying the app')}</p>
        <p style="margin-bottom:10px">${L('You have logged 3 migraines. Would you answer a short form about the app? It takes about 5 minutes and is anonymous.')}</p>
        <div class="row"><a class="btn" style="text-align:center;text-decoration:none" href="${EVAL_FORM}" target="_blank" rel="noopener" data-a="inviteDone">${L('Answer the form')}</a>
        <button class="btn outline" data-a="inviteLater">${L('Not now')}</button></div></div>` : ''}
      ${last ? `<div class="card lastcard${S.lastOpen ? ' open' : ''}"><button class="lasthead" data-a="lastToggle" aria-expanded="${!!S.lastOpen}">
          <span><span class="label" style="display:block">${L('Last migraine')}</span><span>${esc(lastTxt)}</span></span><span class="chev">›</span></button>
          ${S.lastOpen ? migDetail(last) : ''}</div>`
        : `<div class="card"><p class="label">${L('Last migraine')}</p><p>${esc(lastTxt)}</p></div>`}
      <div class="card"><p class="label">${L('This month')}</p><p class="big">${TX.logged(month)}</p>
        <button class="textlink" data-a="go" data-v="history">${L('See History ›')}</button></div>
      <div class="card"><p class="big" style="margin-bottom:6px">${L('Doctor visit coming up?')}</p>
        <p class="muted" style="margin-bottom:12px">${L('The app reads your full history and drafts a summary you can review and email.')}</p>
        <button class="btn outline" data-a="go" data-v="doctor">${L('Prepare doctor summary')}</button></div>
    </div>${nav('home')}`;
  },

  log1() {
    const d = S.draft, a = d.auto;
    return step(1, 'When did it start?', 'How strong it is, and what changed in the last 24 hours.', `
      <div class="autobox compact"><p class="label">${L('Filled in automatically')}</p>
        <div class="autogrid"><div><small>${L('Sleep last night')}</small><b>${a ? hm(a.sleepMin) : '…'}</b></div>
          <div><small>${L('Weather')}</small><b>${a && a.weather ? esc(a.weather) : '…'}</b></div>
          <div><small>${L('Screen time')}</small><b>${a ? hm(a.screenMin) : '…'}</b></div></div>
        <p class="note">${L('With your permission: smartwatch, weather change since yesterday, phone. Sample data.')}</p></div>
      <div class="card"><p class="label">${L('Started')}</p>${chips('started', OPT.started, d.started)}
        ${d.started === 'Another day' ? `<div class="pastrow"><label><small>${L('Day')}</small><input id="pastDate" type="date" max="${dayISO(new Date())}" value="${d.date}"></label>
          <label><small>${L('Time (about)')}</small><input id="pastTime" type="time" value="${d.time}"></label></div>
          <p class="note">${L('For a migraine that happened before. The weather is looked up for that day.')}</p>` : ''}</div>
      <div class="card"><p class="label">${L('Intensity (1 = mild, 10 = severe)')}</p>
        <div class="circles">${[1,2,3,4,5,6,7,8,9,10].map(n =>
          `<button class="chip" data-a="intensity" data-v="${n}" aria-pressed="${d.intensity === n}">${n}</button>`).join('')}</div></div>
      <div class="card"><p class="label">${L('Still ongoing?')}</p>${chips('ongoing', OPT.ongoing, d.ongoing)}
        ${d.ongoing === 'No' ? `<div class="duration"><p class="label" style="margin-top:14px">${L('How long did it last?')}</p>
          <div class="durrow"><div class="stepper"><button data-a="dur" data-v="-1" aria-label="${L('Less')}">−</button>
            <input id="durValue" type="number" inputmode="numeric" min="1" max="999" value="${d.durValue}">
            <button data-a="dur" data-v="1" aria-label="${L('More')}">+</button></div>
            ${chips('unit', UNITS, d.unit)}</div></div>` : ''}</div>
      ${optCard('routine', d.routine)}`, 'log3', 'home');
  },

  log3() {
    const d = S.draft;
    return step(2, 'Food, drink and feelings', 'Select what applies. Everything is optional.', `
      ${optCard('food', d.food)}
      ${optCard('feelings', d.feelings)}`, 'log4', 'log1');
  },

  log4() {
    const d = S.draft;
    return step(3, 'What happened after?', 'Medication and what helped. Everything here is optional.', `
      <div class="card"><p class="label">${L('Medication taken')}</p>${chips('medication', OPT.medication, d.medication)}</div>
      <div class="card"><p class="label">${L('What helped')}</p>${chips('helped', OPT.helped, d.helped)}</div>
      <div class="card"><p class="label">${L('Note (optional)')}</p>
        <textarea id="note" placeholder="${L('Tap to write anything else worth remembering…')}">${esc(d.note)}</textarea></div>`, 'save', 'log3', 'Save migraine');
  },

  saved() {
    return `<div class="screen"><div class="center">
      <div class="check">✓</div><h1 style="font-size:26px">${L('Migraine logged')}</h1>
      <p class="muted">${L('It has been added to your History. Take care of yourself.')}</p></div>
      <div class="footer"><button class="btn" data-a="go" data-v="history">${L('Go to History')}</button>
        <button class="btn outline" data-a="go" data-v="home">${L('Back to Home')}</button></div></div>`;
  },

  history() {
    const all = logs(), now = new Date(), list = inPeriod(all, S.period);
    const months = [...Array(6)].map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { key: monthKey(d), label: fmtMonth(d), n: all.filter(l => l.start.startsWith(monthKey(d))).length };
    });
    const max = Math.max(1, ...months.map(m => m.n));
    const top = topFactors(list).slice(0, 4), topMax = top.length ? top[0][1] : 1;
    const per = TX.per(S.period);
    return `<div class="screen"><h1 style="margin-top:12px">${L('History')}</h1>
      <div class="seg" role="group" aria-label="Period">${[['30d', '30 days'], ['6m', '6 months'], ['all', 'All time']].map(([k, l]) =>
        `<button data-a="period" data-v="${k}" aria-pressed="${S.period === k}">${L(l)}</button>`).join('')}</div>
      <div class="row">
        <div class="card stat grow"><b>${list.length}</b><span>${TX.migraines(list.length).replace(/^\d+ /, '')} ${per}</span></div>
        <div class="card stat grow"><b>${inPeriod(all, '30d').length}</b><span>${L('in the last 30 days')}</span></div></div>
      <div class="flip${S.month ? ' flipped' : ''}" id="monthFlip"><div class="flip-inner">
        <div class="card face face-front"><div class="dhead"><p class="label" style="margin:0">${L('Migraines per month')}</p>
          <button class="textlink small" style="margin:0" data-a="month" data-v="${latestMonth(all)}">${L('See durations ›')}</button></div><div class="bars" style="margin-top:10px">${months.map(m =>
          `<button class="col ${m.n ? '' : 'zero'}" data-a="month" data-v="${m.key}" aria-label="${esc(m.label)}: ${m.n}"><i style="height:${Math.round(m.n / max * 70)}%"></i><span>${m.label}</span></button>`).join('')}</div>
          <p class="note">${L('Tap a bar to see how long each migraine lasted.')}</p></div>
        <div class="card face face-back" id="monthBack">${S.month ? monthDetail(S.month) : ''}</div>
      </div></div>
      <div class="card"><p class="label">${L('Most logged alongside a migraine')}</p>
        ${top.length ? top.map(([k, n]) => `<div class="factor"><div><span>${esc(L(k))}</span><b>${n}×</b></div>
          <div class="meter"><i style="width:${Math.round(n / topMax * 90)}%"></i></div></div>`).join('') : `<p class="muted">${L('Log a few migraines to see what comes up most.')}</p>`}
        <p class="note">${L(all.some(l => l.demo) ? 'Counts from your past entries only. Sample data.' : 'Counts from your past entries only.')}</p></div>
    </div>${nav('history')}`;
  },

  doctor() {
    const all = logs(), st = stats(all);
    if (!st) return `<div class="screen"><h1 style="margin-top:12px">${L('Doctor summary')}</h1>
      <div class="card"><p class="muted">${L('No migraines logged in the last 6 months yet. Log one and a summary will appear here.')}</p></div></div>${nav('doctor')}`;
    if (!S.sum) S.sum = localSummary(st);
    const s = S.sum, ed = S.editing ? 'true' : 'false';
    return `<div class="screen"><h1 style="margin-top:12px">${L('Doctor summary')}</h1>
      <div class="banner"><b>${L(s.ai ? 'Drafted by AI from your full history' : s.loading ? 'Improving with AI…' : 'Drafted automatically from your entries')}</b>${L('Review and edit before you share it.')}</div>
      <div class="card sum">
        <h3 contenteditable="${ed}" data-k="title">${esc(s.title)}</h3>
        <p class="label">${L('Frequency')}</p><div class="val" contenteditable="${ed}" data-k="frequency">${esc(s.frequency)}</div>
        <p class="label">${esc(L('Intensity & duration'))}</p><div class="val" contenteditable="${ed}" data-k="intensity">${esc(s.intensity)}</div>
        <p class="label">${L('Logged alongside')}</p><div class="val" contenteditable="${ed}" data-k="alongside">${esc(s.alongside)}</div>
        <p class="label">${L('Questions for the doctor')}</p><div class="val q" contenteditable="true" data-k="questions" data-ph="${L('Add your own before sending…')}">${esc(s.questions)}</div>
      </div>
      <div class="footer"><button class="btn soft" data-a="ai" ${s.ai || s.loading ? 'disabled' : ''}>${L(s.loading ? 'Improving…' : s.ai ? 'Improved with AI ✓' : 'Improve with AI')}</button>
        <button class="btn outline" data-a="edit">${L(S.editing ? 'Done editing' : 'Edit text')}</button>
        <button class="btn" data-a="email">${L('Send by email')}</button></div>
    </div>${nav('doctor')}`;
  },

  end() {
    const e = S.end;
    return `<div class="screen"><div class="stephead"><button class="back" data-a="go" data-v="home">${L('‹ Back')}</button></div>
      <h1>${L('How long did it last?')}</h1>
      <p class="sub">${esc(TX.startedAt(new Date(e.start).toLocaleString(LOC, { weekday: 'long', hour: '2-digit', minute: '2-digit' })))}</p>
      <div class="card"><p class="label">${L('Duration')}</p>
        <div class="durrow"><div class="stepper"><button data-a="enddur" data-v="-1" aria-label="${L('Less')}">−</button>
          <input id="endValue" type="number" inputmode="numeric" min="1" max="999" value="${e.value}">
          <button data-a="enddur" data-v="1" aria-label="${L('More')}">+</button></div>
          ${chips('endunit', UNITS, e.unit)}</div>
        <p class="note">${L('Filled in with the time since it started. Change it if it ended earlier.')}</p></div>
      <div class="footer"><button class="btn" data-a="endSave">${L('Save')}</button></div></div>`;
  },

  settings() {
    const s = settings();
    return `<div class="screen"><div class="stephead"><button class="back" data-a="go" data-v="home">${L('‹ Back')}</button></div>
      <h1>${L('Settings')}</h1>
      <div class="card"><p class="label">${L('Night mode')}</p>
        <p class="muted small" style="margin-bottom:10px">${L('Darker, softer colours for light sensitivity.')}</p>
        <div class="chips">${[['auto', 'Follow phone'], ['dark', 'On'], ['light', 'Off']].map(([k, l]) =>
          `<button class="chip" data-a="theme" data-v="${k}" aria-pressed="${s.theme === k}">${L(l)}</button>`).join('')}</div></div>
      <div class="card"><p class="label">${L('Feedback')}</p>
        <p class="muted small" style="margin-bottom:10px">${L('Have a suggestion or found a problem? Tell the team in a short, anonymous form.')}</p>
        <a class="btn outline" style="display:block;text-align:center;text-decoration:none;margin-bottom:10px" href="${EVAL_FORM}" target="_blank" rel="noopener">${L('Answer the evaluation form')}</a>
        <a class="btn" style="display:block;text-align:center;text-decoration:none" href="${FEEDBACK_FORM}" target="_blank" rel="noopener">${L('Send a suggestion')}</a>
        <p class="note">${L('Suggestions go to a Google form. Please do not write your name or personal health details.')}</p></div>
      <div class="card"><p class="label">${L('Test data')}</p>
        <p class="muted small" style="margin-bottom:12px">${L('Fictional entries so you can explore History and the doctor summary.')}</p>
        <div class="row"><button class="btn" data-a="demo">${L('Load sample data')}</button>
        <button class="btn outline" data-a="clear">${L('Delete all')}</button></div></div>
      <p class="muted small">${L('Your entries are stored only on this device.')}</p></div>`;
  }
};

// A food/feelings card. "Add/remove" (bottom left) opens it for editing: × removes an option, + adds one back or adds a new one.
function optCard(g, sel) {
  const st = settings(), shown = optionsFor(g), editing = S.editG === g;
  const hint = g === 'routine' && shown.includes('Menstruation') ? `<p class="note">${L('Menstruation is optional: remove it with Add/remove if you do not need it.')}</p>` : '';
  if (!editing) return `<div class="card"><p class="label">${L(SECTION[g])}</p>${chips(g, shown, sel)}${hint}
    <button class="textlink small editlink" data-a="optEdit" data-g="${g}">${L('Add/remove')}</button></div>`;
  const fixed = o => o === 'Nothing unusual' || o === 'No change';
  const more = [...OPT[g].filter(o => (st.hidden[g] || []).includes(o)), ...EXTRA[g], ...st.custom[g]].filter(o => !shown.includes(o));
  return `<div class="card editing"><p class="label">${L(SECTION[g])}</p>
    <p class="note" style="margin:0 0 8px">${L('Tap × to remove an option, + to add one.')}</p>
    <div class="chips">${shown.map(o => fixed(o) ? `<span class="chip ghost">${esc(L(o))}</span>`
      : `<span class="chipwrap"><span class="chip ghost">${esc(L(o))}</span><button class="del" data-a="optRemove" data-g="${g}" data-v="${esc(o)}" aria-label="${esc(TX.deleteLabel(L(o)))}">×</button></span>`).join('')}</div>
    ${more.length ? `<p class="small" style="font-weight:600;margin:14px 0 8px">${L('More options')}</p>
    <div class="chips">${more.map(o => `<button class="chip add" data-a="optAdd" data-g="${g}" data-v="${esc(o)}">+ ${esc(L(o))}</button>`).join('')}</div>` : ''}
    <div class="addrow" style="margin-top:12px"><input id="customText" type="text" maxlength="30" placeholder="${L('Write another option')}">
      <button class="btn small-btn" data-a="addCustom" data-g="${g}">${L('Add')}</button></div>
    <button class="textlink small editlink" data-a="optDone">${L('Done')}</button></div>`;
}

function step(n, title, sub, body, next, back, cta = 'Next') {
  title = L(title); sub = L(sub); cta = L(cta);
  return `<div class="screen">
    <div class="stephead"><button class="back" data-a="go" data-v="${back}">${L('‹ Back')}</button><span class="progress">${TX.stepOf(n, 3)}</span>
      <button class="back skiptop" data-a="${next === 'save' ? 'save' : 'go'}" data-v="${next}">${L('Skip ›')}</button></div>
    <div class="segs">${[1,2,3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>
    <h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>${body}
    <div class="footer"><button class="btn" data-a="${next === 'save' ? 'save' : 'go'}" data-v="${next}">${cta}</button></div></div>`;
}

// ---------- AI draft (Cloudflare function → Gemini) ----------
async function draftWithAI(st) {
  S.sum.loading = true; S.editing = false; render();
  let ok = false;
  try {
    const r = await fetch('/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats: st, lang: LANG }), signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (!j.sections || S.editing || !S.sum) throw new Error('skip');
    Object.assign(S.sum, { frequency: j.sections.frequency || S.sum.frequency, intensity: j.sections.intensity || S.sum.intensity,
      alongside: j.sections.alongside || S.sum.alongside, ai: true }); ok = true;
  } catch { /* keep the automatic text */ }
  if (S.sum) S.sum.loading = false;
  if (!ok) toast(L('AI is unavailable right now. Kept the automatic text.'));
  if (S.screen === 'doctor') render();
}

// ---------- Sample data (fictional, shaped like the Figma sample) ----------
function demoLogs() {
  const now = new Date();
  const plan = [ // [days ago, intensity, hours, factors...]
    [3, 7, 4, 'sleep', 'Stressed', 'Skipped a meal', 'Coffee'], [12, 8, 5, 'sleep', 'Stressed', 'Little water'], [24, 6, 3, 'sleep', 'Skipped a meal'],
    [38, 7, 4, 'sleep', 'Stressed', 'Coffee'], [50, 6, 3, 'Stressed', 'Skipped a meal'], [75, 8, 5, 'sleep', 'Coffee'],
    [105, 7, 4, 'Irregular schedule'], [130, 6, 3, 'sleep', 'Tired'], [150, 7, 4, 'Late night']
  ];
  const where = f => OPT.routine.includes(f) ? 'routine' : OPT.food.includes(f) ? 'food' : 'feelings';
  return plan.map(([ago, intensity, durationH, ...f], i) => {
    const d = new Date(now - ago * DAY); d.setHours(9 + i % 8, 0, 0, 0);
    const e = { id: 'demo' + i, demo: true, start: localISO(d), intensity, durationH, ongoing: 'No', routine: [], food: [], feelings: [],
      medication: i % 3 ? 'Took medication' : 'No medication', helped: i % 2 ? ['Dark room', 'Sleep'] : ['Rest'], note: '',
      auto: { sleepMin: f.includes('sleep') ? 320 + (i * 7) % 30 : 430 + (i * 11) % 40, screenMin: 380,
        weather: ['−4 °C, ' + L('rain'), '+5 °C', '±0 °C', '−6 °C, ' + L('rain'), '+3 °C', '−2 °C', '+7 °C', '−3 °C, ' + L('rain'), '+1 °C'][i % 9] } };
    f.filter(x => x !== 'sleep').forEach(x => e[where(x)].push(x));
    return e;
  });
}

// ---------- Rendering & events ----------
function render() {
  const app = document.getElementById('app');
  const keep = app.dataset.screen === S.screen ? window.scrollY : 0;
  app.innerHTML = (screens[S.screen] || screens.home)(); app.dataset.screen = S.screen;
  window.scrollTo(0, keep);
}
const syncNote = () => { const n = document.getElementById('note'); if (n) S.draft.note = n.value; };
function go(screen) {
  if (S.screen === 'log4') syncNote();
  if (screen === 'doctor' && S.screen !== 'doctor') { S.sum = null; S.editing = false; }
  if (screen !== 'history') S.month = null;
  S.editG = null;
  S.screen = screen; render(); window.scrollTo(0, 0);
  if (screen === 'log1') loadAuto();
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, v = el.dataset.v, D = S.draft;
  if (a === 'go') return go(v);
  if (a === 'start') { S.draft = blankDraft(); return go('log1'); }
  if (a === 'intensity') { D.intensity = +v; return render(); }
  if (a === 'period') { S.period = v; return render(); }
  if (a === 'month') { // flip the chart card to show durations, without re-rendering so the rotation animates
    S.month = v; S.openMig = null; document.getElementById('monthBack').innerHTML = monthDetail(v);
    document.getElementById('monthFlip').classList.add('flipped'); return;
  }
  if (a === 'lastToggle') { S.lastOpen = !S.lastOpen; return render(); }
  if (a === 'mig') { S.openMig = S.openMig === v ? null : v; document.getElementById('monthBack').innerHTML = monthDetail(S.month); return; }
  if (a === 'monthBack') { S.month = null; document.getElementById('monthFlip').classList.remove('flipped'); return; }
  if (a === 'endStart') {
    const l = logs().find(x => x.id === v); if (!l) return;
    const [value, unit] = toValUnit(elapsedH(l)); S.end = { id: l.id, start: l.start, value, unit }; return go('end');
  }
  if (a === 'enddur') { S.end.value = Math.max(1, Math.min(999, (+S.end.value || 1) + +v)); return render(); }
  if (a === 'chip' && el.dataset.g === 'endunit') { S.end.unit = v; return render(); }
  if (a === 'endSave') {
    const all = read('mc.logs', []), l = all.find(x => x.id === S.end.id);
    if (l) { l.ongoing = 'No'; l.durationH = Math.round(toHours(+S.end.value || 1, S.end.unit) * 100) / 100; saveLogs(all); }
    S.end = null; toast(L('Saved. Take care of yourself.')); return go('home');
  }
  if (a === 'chip') {
    const g = el.dataset.g;
    if (SINGLE.includes(g)) {
      const before = D[g]; D[g] = (g === 'medication' && D[g] === v) ? null : v;
      if (g === 'started' && before !== v) {
        if (v === 'Another day') D.ongoing = 'No'; // a past migraine has usually ended
        loadAuto(true);
      }
    }
    else {
      const arr = D[g], i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1);
      else {
        if (EXCLUSIVE[v] === g) arr.length = 0;
        else { const ex = Object.keys(EXCLUSIVE).find(k => EXCLUSIVE[k] === g); const j = arr.indexOf(ex); if (j >= 0) arr.splice(j, 1); }
        arr.push(v);
      }
    }
    syncNote(); return render();
  }
  if (a === 'save') {
    syncNote();
    const { started, ...rest } = D;
    const all = read('mc.logs', []);
    const { durValue, unit, ...entry } = rest;
    if (entry.ongoing === 'No') entry.durationH = Math.round(toHours(+durValue || 1, unit) * 100) / 100;
    const { date, time, ...clean } = entry;
    all.push(Object.assign({ id: 'l' + Date.now(), start: startFrom(started, date, time) }, clean));
    saveLogs(all); S.draft = blankDraft(); return go('saved');
  }
  if (a === 'night') { write('mc.settings', Object.assign(settings(), { theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' })); applyTheme(); return render(); }
  if (a === 'share') {
    if (navigator.share) { navigator.share({ title: 'Migraine Compass', text: shareText(), url: APP_URL }).catch(() => {}); return; }
    S.share = !S.share; return render();
  }
  if (a === 'shareClose') { S.share = false; return render(); }
  if (a === 'shareCopy') {
    (navigator.clipboard ? navigator.clipboard.writeText(APP_URL) : Promise.reject()).then(() => toast(L('Link copied')), () => toast(APP_URL)); return;
  }
  if (a === 'optEdit') { S.editG = el.dataset.g; return render(); }
  if (a === 'optDone') { S.editG = null; return render(); }
  if (a === 'optRemove') {
    const g = el.dataset.g, st = settings();
    if (OPT[g].includes(v)) { if (!st.hidden[g].includes(v)) st.hidden[g].push(v); }
    else if (st.custom[g].includes(v)) st.custom[g] = st.custom[g].filter(o => o !== v);
    st.extras[g] = st.extras[g].filter(o => o !== v);
    D[g] = D[g].filter(o => o !== v);
    saveSettings({ hidden: st.hidden, extras: st.extras, custom: st.custom }); toast(TX.deleted(L(v))); return render();
  }
  if (a === 'optAdd') {
    const g = el.dataset.g, st = settings();
    st.hidden[g] = st.hidden[g].filter(o => o !== v);
    if (!OPT[g].includes(v) && !st.extras[g].includes(v)) st.extras[g].push(v);
    saveSettings({ hidden: st.hidden, extras: st.extras }); return render();
  }
  if (a === 'addCustom') {
    const t = document.getElementById('customText').value.trim().replace(/\s+/g, ' '), g = el.dataset.g, st = settings();
    if (!t) return toast(L('Type an option first'));
    const all = [...OPT[g], ...EXTRA[g], ...st.custom[g]];
    const same = all.find(o => o.toLowerCase() === t.toLowerCase() || L(o).toLowerCase() === t.toLowerCase());
    if (same) { // already exists: just show it again
      st.hidden[g] = st.hidden[g].filter(o => o !== same);
      if (!OPT[g].includes(same) && !st.extras[g].includes(same)) st.extras[g].push(same);
      saveSettings({ hidden: st.hidden, extras: st.extras }); return render();
    }
    st.custom[g].push(t); st.extras[g].push(t);
    saveSettings({ extras: st.extras, custom: st.custom }); toast(TX.added(L(SECTION[g]))); return render();
  }
  if (a === 'inviteDone') { saveSettings({ invite: 'done' }); setTimeout(render, 300); return; }
  if (a === 'inviteLater') { saveSettings({ invite: 'later' }); return render(); }
  if (a === 'dur') { D.durValue = Math.max(1, Math.min(999, (+D.durValue || 1) + +v)); return render(); }
  if (a === 'theme') { write('mc.settings', Object.assign(settings(), { theme: v })); applyTheme(); return render(); }
  if (a === 'ai') { if (S.sum && !S.sum.loading) draftWithAI(stats(logs())); return; }
  if (a === 'edit') { S.editing = !S.editing; return render(); }
  if (a === 'email') {
    const s = S.sum;
    const body = `${s.title}\n\n${L('Frequency')}: ${s.frequency}\n${L('Intensity & duration')}: ${s.intensity}\n${L('Logged alongside')}: ${s.alongside}` +
      (s.questions.trim() ? `\n\n${L('Questions for the doctor')}:\n${s.questions.trim()}` : '');
    location.href = `mailto:?subject=${encodeURIComponent(L('Migraine summary'))}&body=${encodeURIComponent(body)}`; return;
  }
  if (a === 'demo') { const rest = read('mc.logs', []).filter(l => !l.demo); saveLogs([...rest, ...demoLogs()]); toast(L('Sample data loaded')); return; }
  if (a === 'clear') { if (confirm(L('Delete all migraine entries on this device?'))) { saveLogs([]); toast(L('All entries deleted')); } return; }
});
document.addEventListener('change', e => {
  if (e.target.id === 'pastDate' || e.target.id === 'pastTime') {
    const today = dayISO(new Date());
    if (e.target.id === 'pastDate') S.draft.date = e.target.value && e.target.value <= today ? e.target.value : today;
    else S.draft.time = e.target.value || '12:00';
    loadAuto(true); return;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'note') S.draft.note = e.target.value;
  if (e.target.id === 'endValue' && S.end) S.end.value = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1));
  if (e.target.id === 'durValue') S.draft.durValue = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1));
  const k = e.target.dataset && e.target.dataset.k;
  if (k && S.sum) S.sum[k] = e.target.innerText;
});

render();
// Updates: check for a new version when the app opens or comes back to the front. When a new version takes over,
// reload at once, unless the person is in the middle of logging; then offer a button so nothing typed is lost.
if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; } // first install: nothing to refresh
    if (reloading) return;
    const busy = ['log1', 'log3', 'log4', 'end'].includes(S.screen);
    if (!busy) { reloading = true; location.reload(); return; }
    if (document.getElementById('updateBar')) return;
    const bar = document.createElement('div'); bar.id = 'updateBar';
    bar.innerHTML = `<span>${L('A new version of the app is available.')}</span><button>${L('Update')}</button>`;
    bar.querySelector('button').onclick = () => { reloading = true; location.reload(); };
    document.body.appendChild(bar);
  });
}
