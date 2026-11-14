/* Migraine Compass — prototype PWA. All data stays on the device (localStorage). */
'use strict';

// ---------- Options ----------
const OPT = {
  routine: ['Irregular schedule', 'Skipped exercise', 'More exercise', 'Sun exposure', 'Trip', 'Late night', 'Menstruation', 'No change'],
  food: ['Skipped a meal', 'Late meal', 'Coffee', 'Alcohol', 'Chocolate', 'Aged cheese', 'Processed food', 'Little water', 'Nothing unusual'],
  feelings: ['Stressed', 'Anxious', 'Sad', 'Irritable', 'Tired', 'Calm', 'Happy', 'Excited'],
  medication: ['Took medication', 'No medication'],
  helped: ['Dark room', 'Rest', 'Sleep']
};
const EXCLUSIVE = { 'No change': 'routine', 'Nothing unusual': 'food' };

// ---------- Storage ----------
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full/blocked */ } };
const logs = () => read('mc.logs', []).sort((a, b) => b.start.localeCompare(a.start));
const saveLogs = v => write('mc.logs', v);
const settings = () => Object.assign({ menstruation: true }, read('mc.settings', {}));

// ---------- State ----------
const nowLocal = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const blankDraft = () => ({
  start: nowLocal(), intensity: 7, ongoing: false,
  routine: [], food: [], feelings: [], medication: null, helped: [], note: '', auto: null
});
const S = { screen: 'home', draft: blankDraft(), period: '6m', summary: null, summaryAI: false, summaryBusy: false };

// ---------- Helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDay = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const hm = min => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const toast = msg => {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
};
const chip = (group, label, on) =>
  `<button class="chip" data-a="chip" data-g="${group}" data-v="${esc(label)}" aria-pressed="${on}">${esc(label)}</button>`;
const chips = (group, list, selected) =>
  `<div class="chips">${list.map(l => chip(group, l, selected.includes(l))).join('')}</div>`;

function nav(active) {
  const items = [['home', '⌂', 'Home'], ['history', '▤', 'History'], ['doctor', '✚', 'Doctor']];
  return `<nav class="tabs">${items.map(([id, ic, lb]) =>
    `<button data-a="go" data-v="${id}" ${id === active ? 'aria-current="page"' : ''}><span>${ic}</span>${lb}</button>`).join('')}</nav>`;
}

// ---------- Automatic data (simulated where the web can't read it) ----------
// Sleep (smartwatch) and screen time are simulated for the test; weather is real when location is allowed.
function simulatedAuto() {
  const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
  return { sleepMin: rnd(280, 460), screenMin: rnd(180, 480), weather: null, simulated: true };
}
async function fetchWeather() {
  try {
    const pos = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { timeout: 6000, maximumAge: 600000 }));
    const { latitude: la, longitude: lo } = pos.coords;
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=temperature_2m_mean,precipitation_sum&past_days=1&forecast_days=1&timezone=auto`;
    const j = await (await fetch(u)).json();
    const [y, t] = j.daily.temperature_2m_mean; const rain = j.daily.precipitation_sum[1] > 0.2;
    const diff = Math.round(t - y);
    return `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff)} °C vs yesterday${rain ? ', rain' : ''}`;
  } catch { return null; }
}
async function loadAuto() {
  const d = S.draft; if (d.auto) return;
  d.auto = simulatedAuto();
  render();
  const w = await fetchWeather();
  d.auto.weather = w || 'Unavailable (location off)';
  if (S.screen === 'log2') render();
}

// ---------- Screens ----------
const screens = {
  home() {
    const all = logs(), last = all[0], key = monthKey(new Date());
    const month = all.filter(l => l.start.startsWith(key)).length;
    return `<div class="screen has-nav">
      <div class="top"><div><p class="muted small">Hello</p><h1>Migraine Compass</h1></div>
        <button class="icon-btn" data-a="go" data-v="settings" aria-label="Settings">⚙</button></div>
      <div class="card"><h2>How are you now?</h2>
        <button class="btn" data-a="start">Log a migraine</button></div>
      <div class="row">
        <div class="card stat"><h2>Last migraine</h2><b style="font-size:20px">${last ? esc(fmtDay(last.start)) : '—'}</b>
          <span class="muted small">${last ? `Intensity ${last.intensity}/10` : 'Nothing logged yet'}</span></div>
        <div class="card stat"><h2>This month</h2><b>${month}</b><span class="muted small">${month === 1 ? 'migraine' : 'migraines'}</span></div>
      </div>
      <div class="card"><h2>Doctor visit coming up?</h2>
        <p class="muted small" style="margin-bottom:12px">Get a short summary of your recent migraines to share.</p>
        <button class="btn secondary" data-a="go" data-v="doctor">Prepare summary</button></div>
    </div>${nav('home')}`;
  },

  log1() {
    const d = S.draft;
    return step(1, 'When did it start?', `
      <div class="card"><h2>Started</h2>
        <input type="datetime-local" id="start" value="${esc(d.start)}" max="${nowLocal()}"></div>
      <div class="card"><h2>Intensity</h2>
        <div class="scale">${[1,2,3,4,5,6,7,8,9,10].map(n =>
          `<button class="chip" data-a="intensity" data-v="${n}" aria-pressed="${d.intensity === n}">${n}</button>`).join('')}</div>
        <p class="muted small" style="margin-top:10px">1 = mild · 10 = worst imaginable</p></div>
      <div class="card"><label class="switch"><span>Still ongoing</span>
        <input type="checkbox" id="ongoing" ${d.ongoing ? 'checked' : ''}></label></div>`, 'log2', 'home');
  },

  log2() {
    const d = S.draft, a = d.auto || { sleepMin: 0, screenMin: 0, weather: null };
    const list = OPT.routine.filter(o => settings().menstruation || o !== 'Menstruation');
    return step(2, 'Routine', `
      <div class="card"><h2>Collected automatically</h2>
        <div class="auto">
          <div><span>Sleep last night</span><b>${d.auto ? hm(a.sleepMin) : '…'}</b></div>
          <div><span>Weather</span><b>${a.weather ? esc(a.weather) : '…'}</b></div>
          <div><span>Screen time</span><b>${d.auto ? hm(a.screenMin) : '…'}</b></div>
        </div>
        <p class="muted small" style="margin-top:10px">Sleep and screen time are simulated in this test version.</p></div>
      <div class="card"><h2>Anything different today?</h2>${chips('routine', list, d.routine)}
        <p class="muted small" style="margin-top:10px">Menstruation can be hidden in Settings.</p></div>`, 'log3', 'log1');
  },

  log3() {
    const d = S.draft;
    return step(3, 'Food, drink and feelings', `
      <div class="card"><h2>Food and drink</h2>${chips('food', OPT.food, d.food)}</div>
      <div class="card"><h2>How are you feeling?</h2>${chips('feelings', OPT.feelings, d.feelings)}</div>`, 'log4', 'log2');
  },

  log4() {
    const d = S.draft;
    return step(4, 'What happened after?', `
      <div class="card"><h2>Medication taken</h2>${chips('medication', OPT.medication, d.medication ? [d.medication] : [])}</div>
      <div class="card"><h2>What helped</h2>${chips('helped', OPT.helped, d.helped)}</div>
      <div class="card"><h2>Note (optional)</h2>
        <textarea id="note" placeholder="Anything else you want to remember…">${esc(d.note)}</textarea></div>`, 'save', 'log3', 'Save migraine');
  },

  saved() {
    return `<div class="screen"><div class="center">
      <div class="check">✓</div><h1>Saved</h1>
      <p class="muted">Your migraine was added to your history.</p></div>
      <div class="footer"><button class="btn" data-a="go" data-v="history">See history</button>
        <button class="btn ghost" data-a="go" data-v="home">Back to home</button></div></div>`;
  },

  history() {
    const all = logs(), now = new Date();
    const cut = S.period === '30d' ? new Date(now - 30 * 864e5) : S.period === '6m' ? new Date(now.getFullYear(), now.getMonth() - 5, 1) : new Date(0);
    const list = all.filter(l => new Date(l.start) >= cut);
    const last30 = all.filter(l => new Date(l.start) >= new Date(now - 30 * 864e5)).length;
    const months = [...Array(6)].map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { label: d.toLocaleDateString('en-GB', { month: 'short' }), n: all.filter(l => l.start.startsWith(monthKey(d))).length };
    });
    const max = Math.max(1, ...months.map(m => m.n));
    const top = topFactors(list).slice(0, 4);
    return `<div class="screen has-nav"><h1>History</h1>
      <div class="seg" role="group" aria-label="Period">${[['6m', '6 months'], ['30d', '30 days'], ['all', 'All']].map(([k, l]) =>
        `<button data-a="period" data-v="${k}" aria-pressed="${S.period === k}">${l}</button>`).join('')}</div>
      <div class="row">
        <div class="card stat"><b>${list.length}</b><span class="muted small">in ${S.period === '30d' ? '30 days' : S.period === '6m' ? '6 months' : 'total'}</span></div>
        <div class="card stat"><b>${last30}</b><span class="muted small">in last 30 days</span></div></div>
      <div class="card"><h2>Per month</h2><div class="bars">${months.map(m =>
        `<div class="col ${m.n ? '' : 'zero'}"><i style="height:${Math.round(m.n / max * 80)}%"></i><span>${m.label}</span></div>`).join('')}</div></div>
      <div class="card"><h2>Most logged</h2>${top.length ? top.map(([k, n]) =>
        `<div class="factor"><span>${esc(k)}</span><b>${n}×</b></div>`).join('') : '<p class="muted small">Log a few migraines to see patterns.</p>'}</div>
      <div class="card"><h2>Attacks</h2>${list.length ? list.map(l => `<div class="attack">
        <div class="between row"><b>${esc(fmtDate(l.start))}</b><span class="pill">${l.intensity}/10</span></div>
        <p class="muted small">${esc([...l.routine, ...l.food, ...l.feelings].slice(0, 4).join(' · ') || 'No factors logged')}</p></div>`).join('')
        : '<p class="muted small">Nothing here yet.</p>'}</div>
    </div>${nav('history')}`;
  },

  doctor() {
    const all = logs();
    if (S.summary === null) S.summary = buildSummary(all);
    return `<div class="screen has-nav"><h1>Doctor summary</h1>
      ${S.summaryAI ? '<div class="banner">Drafted by AI from your counts only. Check it before sharing.</div>' : ''}
      <div class="card"><textarea id="summary" style="min-height:230px" ${all.length ? '' : 'disabled'}>${esc(S.summary)}</textarea></div>
      <button class="btn secondary" data-a="ai" ${all.length && !S.summaryBusy ? '' : 'disabled'}>${S.summaryBusy ? 'Drafting…' : 'Improve with AI'}</button>
      <button class="btn ghost" data-a="reset-summary" ${all.length ? '' : 'disabled'}>Reset to automatic text</button>
      <button class="btn" data-a="email" ${all.length ? '' : 'disabled'}>Send by email</button>
    </div>${nav('doctor')}`;
  },

  settings() {
    const s = settings();
    return `<div class="screen"><div class="top"><button class="icon-btn" data-a="go" data-v="home" aria-label="Back">←</button><h1>Settings</h1><span style="width:40px"></span></div>
      <div class="card"><label class="switch"><span>Show “Menstruation” option</span>
        <input type="checkbox" id="menstruation" ${s.menstruation ? 'checked' : ''}></label></div>
      <div class="card"><h2>Test data</h2>
        <p class="muted small" style="margin-bottom:12px">Fictional entries so you can explore History and the doctor summary.</p>
        <div class="row"><button class="btn secondary" data-a="demo">Load demo data</button>
        <button class="btn ghost" data-a="clear">Delete all</button></div></div>
      <p class="muted small">Everything is stored only on this device.</p></div>`;
  }
};

function step(n, title, body, next, back, cta = 'Next') {
  return `<div class="screen">
    <div class="top"><button class="icon-btn" data-a="go" data-v="${back}" aria-label="Back">←</button>
      <span class="progress">Step ${n} of 4</span><button class="icon-btn" data-a="cancel" aria-label="Cancel">✕</button></div>
    <div class="bar"><i style="width:${n * 25}%"></i></div>
    <h1>${esc(title)}</h1>${body}
    <div class="footer"><button class="btn" data-a="${next === 'save' ? 'save' : 'go'}" data-v="${next}">${cta}</button></div></div>`;
}

// ---------- Analysis ----------
function factorsOf(l) {
  const f = [...l.routine, ...l.food, ...l.feelings].filter(x => x !== 'No change' && x !== 'Nothing unusual' && x !== 'Calm' && x !== 'Happy');
  if (l.auto && l.auto.sleepMin < 360) f.push('Slept under 6 h');
  return f;
}
function topFactors(list) {
  const c = {}; list.forEach(l => factorsOf(l).forEach(f => c[f] = (c[f] || 0) + 1));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function stats(all) {
  const list = all.filter(l => new Date(l.start) >= new Date(Date.now() - 180 * 864e5));
  if (!list.length) return null;
  const avg = list.reduce((s, l) => s + l.intensity, 0) / list.length;
  const med = list.filter(l => l.medication === 'Took medication').length;
  const helped = {}; list.forEach(l => l.helped.forEach(h => helped[h] = (helped[h] || 0) + 1));
  return {
    count: list.length, from: fmtDay(list[list.length - 1].start), to: fmtDay(list[0].start),
    avgIntensity: Math.round(avg * 10) / 10, medication: med,
    topFactors: topFactors(list).slice(0, 5).map(([k, n]) => ({ factor: k, times: n })),
    helped: Object.entries(helped).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ what: k, times: n }))
  };
}
function buildSummary(all) {
  const s = stats(all);
  if (!s) return 'No migraines logged yet. Add entries and a summary will appear here.';
  const lines = [
    `Migraine summary, ${s.from} to ${s.to} (last 6 months).`,
    `Logged ${s.count} migraine${s.count === 1 ? '' : 's'}, average intensity ${s.avgIntensity}/10.`,
    `Medication taken in ${s.medication} of ${s.count}.`
  ];
  if (s.topFactors.length) lines.push(`Most frequent factors: ${s.topFactors.map(f => `${f.factor} (${f.times}×)`).join(', ')}.`);
  if (s.helped.length) lines.push(`What helped: ${s.helped.map(h => `${h.what} (${h.times}×)`).join(', ')}.`);
  return lines.join('\n');
}

// ---------- Demo data (fictional) ----------
function demoLogs() {
  const pick = (a, n) => [...a].sort(() => Math.random() - .5).slice(0, n);
  return [...Array(9)].map((_, i) => {
    const d = new Date(Date.now() - (i * 19 + 3) * 864e5); d.setHours(8 + (i * 3) % 10, 15, 0, 0);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return {
      id: 'demo' + i, demo: true, start: d.toISOString().slice(0, 16), intensity: 4 + (i * 7) % 6, ongoing: false,
      routine: pick(['Irregular schedule', 'Late night', 'Trip', 'Skipped exercise'], 1 + i % 2),
      food: pick(['Skipped a meal', 'Coffee', 'Chocolate', 'Little water'], 1 + i % 2),
      feelings: pick(['Stressed', 'Tired', 'Anxious'], 1),
      medication: i % 3 ? 'Took medication' : 'No medication', helped: pick(OPT.helped, 1 + i % 2), note: '',
      auto: { sleepMin: i % 3 === 0 ? 330 : 420, screenMin: 300, weather: null, simulated: true }
    };
  });
}

// ---------- Rendering & events ----------
function render() {
  const fn = screens[S.screen] || screens.home;
  const html = fn();
  const app = document.getElementById('app');
  const keepScroll = app.dataset.screen === S.screen ? window.scrollY : 0;
  app.innerHTML = html; app.dataset.screen = S.screen;
  window.scrollTo(0, keepScroll);
}
function go(screen) {
  if (S.screen === 'log1') syncLog1();
  if (S.screen === 'log4') syncNote();
  if (screen === 'doctor') S.summary = null;
  S.screen = screen; render();
  if (screen === 'log2') loadAuto();
}
const syncLog1 = () => {
  const s = document.getElementById('start'), o = document.getElementById('ongoing');
  if (s && s.value) S.draft.start = s.value; if (o) S.draft.ongoing = o.checked;
};
const syncNote = () => { const n = document.getElementById('note'); if (n) S.draft.note = n.value; };

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, v = el.dataset.v, D = S.draft;
  if (a === 'go') return go(v);
  if (a === 'start') { S.draft = blankDraft(); return go('log1'); }
  if (a === 'cancel') { if (confirm('Discard this entry?')) { S.draft = blankDraft(); go('home'); } return; }
  if (a === 'intensity') { syncLog1(); D.intensity = +v; return render(); }
  if (a === 'period') { S.period = v; return render(); }
  if (a === 'chip') {
    const g = el.dataset.g;
    if (g === 'medication') D.medication = D.medication === v ? null : v;
    else {
      const arr = D[g], i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1);
      else {
        if (EXCLUSIVE[v] === g) arr.length = 0;
        else { const ex = Object.keys(EXCLUSIVE).find(k => EXCLUSIVE[k] === g); const j = arr.indexOf(ex); if (j >= 0) arr.splice(j, 1); }
        arr.push(v);
      }
    }
    if (g === 'helped' || g === 'feelings') syncNote();
    return render();
  }
  if (a === 'save') {
    syncNote();
    const all = read('mc.logs', []);
    all.push(Object.assign({ id: 'l' + Date.now() }, D));
    saveLogs(all); S.draft = blankDraft(); S.summary = null; return go('saved');
  }
  if (a === 'reset-summary') { S.summary = null; S.summaryAI = false; return render(); }
  if (a === 'email') {
    const body = document.getElementById('summary').value;
    location.href = `mailto:?subject=${encodeURIComponent('Migraine summary')}&body=${encodeURIComponent(body)}`; return;
  }
  if (a === 'ai') {
    S.summary = document.getElementById('summary').value; S.summaryBusy = true; render();
    try {
      const r = await fetch('/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stats: stats(logs()) }), signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json(); if (!j.text) throw new Error('empty');
      S.summary = j.text; S.summaryAI = true;
    } catch { toast('AI is unavailable right now. Kept the automatic text.'); }
    S.summaryBusy = false; return render();
  }
  if (a === 'demo') { const rest = read('mc.logs', []).filter(l => !l.demo); saveLogs([...rest, ...demoLogs()]); toast('Demo data loaded'); return; }
  if (a === 'clear') { if (confirm('Delete all migraine entries on this device?')) { saveLogs([]); S.summary = null; toast('All entries deleted'); } return; }
});
document.addEventListener('change', e => {
  if (e.target.id === 'menstruation') write('mc.settings', Object.assign(settings(), { menstruation: e.target.checked }));
  if (e.target.id === 'ongoing') S.draft.ongoing = e.target.checked;
  if (e.target.id === 'start' && e.target.value) S.draft.start = e.target.value;
});
document.addEventListener('input', e => {
  if (e.target.id === 'note') S.draft.note = e.target.value;
  if (e.target.id === 'summary') S.summary = e.target.value;
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
