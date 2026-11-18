/* Migraine Compass — PWA that mirrors the Figma prototype. All entries stay on the device (localStorage). */
'use strict';

// ---------- Options (same as Figma) ----------
const OPT = {
  started: ['Now', '1 h ago', 'Earlier today', 'Yesterday'],
  ongoing: ['Yes', 'No'],
  routine: ['Irregular schedule', 'Skipped exercise', 'More exercise', 'Sun exposure', 'Trip', 'Late night', 'Menstruation', 'No change'],
  food: ['Skipped a meal', 'Late meal', 'Coffee', 'Alcohol', 'Chocolate', 'Aged cheese', 'Processed food', 'Little water', 'Nothing unusual'],
  feelings: ['Stressed', 'Anxious', 'Sad', 'Irritable', 'Tired', 'Calm', 'Happy', 'Excited'],
  medication: ['Took medication', 'No medication'],
  helped: ['Dark room', 'Rest', 'Sleep']
};
const SINGLE = ['started', 'ongoing', 'medication'];
const EXCLUSIVE = { 'No change': 'routine', 'Nothing unusual': 'food' };

// ---------- Storage ----------
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const logs = () => read('mc.logs', []).sort((a, b) => b.start.localeCompare(a.start));
const saveLogs = v => write('mc.logs', v);
const settings = () => Object.assign({ menstruation: true }, read('mc.settings', {}));

// ---------- State ----------
const blankDraft = () => ({ started: 'Now', intensity: 7, ongoing: 'Yes', routine: [], food: [], feelings: [],
  medication: null, helped: [], note: '', auto: null });
const S = { screen: 'home', draft: blankDraft(), period: '6m', sum: null, editing: false };

// ---------- Helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
const hm = min => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const localISO = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const startFrom = opt => {
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
const chip = (g, l, on) => `<button class="chip" data-a="chip" data-g="${g}" data-v="${esc(l)}" aria-pressed="${on}">${esc(l)}</button>`;
const chips = (g, list, sel) => `<div class="chips">${list.map(l => chip(g, l, Array.isArray(sel) ? sel.includes(l) : sel === l)).join('')}</div>`;

function nav(active) {
  const items = [['home', 'Home'], ['history', 'History'], ['doctor', 'Summary']];
  return `<nav class="tabs">${items.map(([id, lb]) =>
    `<button data-a="go" data-v="${id}" ${id === active ? 'aria-current="page"' : ''}>${lb}</button>`).join('')}</nav>`;
}

// ---------- Automatic data ----------
// Sleep (smartwatch) and screen time are sample data; weather is real when location is allowed.
function sampleAuto() {
  const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
  return { sleepMin: rnd(280, 460), screenMin: rnd(180, 480), weather: null };
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
  d.auto = sampleAuto(); render();
  const w = await fetchWeather();
  d.auto.weather = w || 'Location off';
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
const fmtMonth = d => d.toLocaleDateString('en-GB', { month: 'short' });
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
    topFactors: topFactors(list).slice(0, 4).map(([factor, times]) => ({ factor, times })),
    helped: Object.entries(helped).sort((a, b) => b[1] - a[1]).map(([what, times]) => ({ what, times }))
  };
}
function localSummary(st) {
  const [a, b] = st.intensityRange, d = st.durationRangeHours;
  const along = st.topFactors.map((f, i) => `${i ? f.factor.charAt(0).toLowerCase() + f.factor.slice(1) : f.factor} (${f.times}×)`).join(', ');
  return {
    title: `Migraine summary · ${st.period}`,
    frequency: `${st.count6m} migraine${st.count6m === 1 ? '' : 's'} in 6 months, ${st.last30} in the last 30 days.`,
    intensity: `Usually ${a === b ? a : `${a}–${b}`} out of 10${d ? `, lasting about ${d[0] === d[1] ? d[0] : `${d[0]}–${d[1]}`} hours` : ''}.`,
    alongside: along ? along + '.' : 'Nothing logged alongside yet.',
    questions: '', ai: false
  };
}

// ---------- Screens ----------
const screens = {
  home() {
    const all = logs(), last = all[0];
    const month = all.filter(l => l.start.startsWith(monthKey(new Date()))).length;
    const lastTxt = last ? [new Date(last.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      `intensity ${last.intensity}/10`, last.durationH ? `about ${last.durationH} h` : null].filter(Boolean).join(' · ') : 'Nothing logged yet';
    return `<div class="screen">
      <div class="brand"><span>Migraine Compass</span><button class="gear" data-a="go" data-v="settings" aria-label="Settings">⚙</button></div>
      <h1>How are you today?</h1>
      <button class="hero" data-a="start"><b>Log a migraine</b><span>Three quick steps: when and routine, food and feelings, what helped.</span><i>Start ›</i></button>
      <div class="card"><p class="label">Last migraine</p><p>${esc(lastTxt)}</p></div>
      <div class="card"><p class="label">This month</p><p class="big">${month} migraine${month === 1 ? '' : 's'} logged</p>
        <button class="textlink" data-a="go" data-v="history">See History ›</button></div>
      <div class="card"><p class="big" style="margin-bottom:6px">Doctor visit coming up?</p>
        <p class="muted" style="margin-bottom:12px">The app reads your full history and drafts a summary you can review and email.</p>
        <button class="btn outline" data-a="go" data-v="doctor">Prepare doctor summary</button></div>
    </div>${nav('home')}`;
  },

  log1() {
    const d = S.draft, a = d.auto;
    const list = OPT.routine.filter(o => settings().menstruation || o !== 'Menstruation');
    return step(1, 'When did it start?', 'How strong it is, and what changed in the last 24 hours.', `
      <div class="card"><p class="label">Started</p>${chips('started', OPT.started, d.started)}</div>
      <div class="card"><p class="label">Intensity (1 = mild, 10 = severe)</p>
        <div class="circles">${[1,2,3,4,5,6,7,8,9,10].map(n =>
          `<button class="chip" data-a="intensity" data-v="${n}" aria-pressed="${d.intensity === n}">${n}</button>`).join('')}</div></div>
      <div class="card"><p class="label">Still ongoing?</p>${chips('ongoing', OPT.ongoing, d.ongoing)}</div>
      <div class="autobox"><p class="label">Filled in automatically</p>
        <div class="autorow"><div>Sleep last night<small>From your smartwatch</small></div><b>${a ? hm(a.sleepMin) : '…'}</b></div>
        <div class="autorow"><div>Weather today<small>From the internet, using your location</small></div><b>${a && a.weather ? esc(a.weather) : '…'}</b></div>
        <div class="autorow"><div>Screen time yesterday<small>From your phone</small></div><b>${a ? hm(a.screenMin) : '…'}</b></div>
        <p class="note">Read only with your permission. Sleep and screen time are sample data.</p></div>
      <div class="card"><p class="label">Any change in routine?</p>${chips('routine', list, d.routine)}
        <p class="note">Menstruation is optional and only appears if you turn it on in Settings.</p></div>`, 'log3', 'home');
  },

  log3() {
    const d = S.draft;
    return step(2, 'Food, drink and feelings', 'Select what applies. Everything is optional.', `
      <div class="card"><p class="label">Food and drink</p>${chips('food', OPT.food, d.food)}</div>
      <div class="card"><p class="label">How are you feeling?</p>${chips('feelings', OPT.feelings, d.feelings)}</div>`, 'log4', 'log1');
  },

  log4() {
    const d = S.draft;
    return step(3, 'What happened after?', 'Medication and what helped. Everything here is optional.', `
      <div class="card"><p class="label">Medication taken</p>${chips('medication', OPT.medication, d.medication)}</div>
      <div class="card"><p class="label">What helped</p>${chips('helped', OPT.helped, d.helped)}</div>
      <div class="card"><p class="label">Note (optional)</p>
        <textarea id="note" placeholder="Tap to write anything else worth remembering…">${esc(d.note)}</textarea></div>`, 'save', 'log3', 'Save migraine');
  },

  saved() {
    return `<div class="screen"><div class="center">
      <div class="check">✓</div><h1 style="font-size:26px">Migraine logged</h1>
      <p class="muted">It has been added to your History. Take care of yourself.</p></div>
      <div class="footer"><button class="btn" data-a="go" data-v="history">Go to History</button>
        <button class="btn outline" data-a="go" data-v="home">Back to Home</button></div></div>`;
  },

  history() {
    const all = logs(), now = new Date(), list = inPeriod(all, S.period);
    const months = [...Array(6)].map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { label: fmtMonth(d), n: all.filter(l => l.start.startsWith(monthKey(d))).length };
    });
    const max = Math.max(1, ...months.map(m => m.n));
    const top = topFactors(list).slice(0, 4), topMax = top.length ? top[0][1] : 1;
    const per = { '30d': 'in 30 days', '6m': 'in 6 months', all: 'in total' }[S.period];
    return `<div class="screen"><h1 style="margin-top:12px">History</h1>
      <div class="seg" role="group" aria-label="Period">${[['30d', '30 days'], ['6m', '6 months'], ['all', 'All time']].map(([k, l]) =>
        `<button data-a="period" data-v="${k}" aria-pressed="${S.period === k}">${l}</button>`).join('')}</div>
      <div class="row">
        <div class="card stat grow"><b>${list.length}</b><span>migraine${list.length === 1 ? '' : 's'} ${per}</span></div>
        <div class="card stat grow"><b>${inPeriod(all, '30d').length}</b><span>in the last 30 days</span></div></div>
      <div class="card"><p class="label">Migraines per month</p><div class="bars">${months.map(m =>
        `<div class="col ${m.n ? '' : 'zero'}"><i style="height:${Math.round(m.n / max * 70)}%"></i><span>${m.label}</span></div>`).join('')}</div></div>
      <div class="card"><p class="label">Most logged alongside a migraine</p>
        ${top.length ? top.map(([k, n]) => `<div class="factor"><div><span>${esc(k)}</span><b>${n}×</b></div>
          <div class="meter"><i style="width:${Math.round(n / topMax * 90)}%"></i></div></div>`).join('') : '<p class="muted">Log a few migraines to see what comes up most.</p>'}
        <p class="note">Counts from your past entries only${all.some(l => l.demo) ? '. Sample data.' : '.'}</p></div>
    </div>${nav('history')}`;
  },

  doctor() {
    const all = logs(), st = stats(all);
    if (!st) return `<div class="screen"><h1 style="margin-top:12px">Doctor summary</h1>
      <div class="card"><p class="muted">No migraines logged in the last 6 months yet. Log one and a summary will appear here.</p></div></div>${nav('doctor')}`;
    if (!S.sum) { S.sum = localSummary(st); draftWithAI(st); }
    const s = S.sum, ed = S.editing ? 'true' : 'false';
    return `<div class="screen"><h1 style="margin-top:12px">Doctor summary</h1>
      <div class="banner">${s.ai ? '<b>Drafted by AI from your full history</b>' : s.loading ? '<b>Drafting with AI…</b>' : '<b>Drafted automatically from your entries</b>'}Review and edit before you share it.</div>
      <div class="card sum">
        <h3 contenteditable="${ed}" data-k="title">${esc(s.title)}</h3>
        <p class="label">Frequency</p><div class="val" contenteditable="${ed}" data-k="frequency">${esc(s.frequency)}</div>
        <p class="label">Intensity &amp; duration</p><div class="val" contenteditable="${ed}" data-k="intensity">${esc(s.intensity)}</div>
        <p class="label">Logged alongside</p><div class="val" contenteditable="${ed}" data-k="alongside">${esc(s.alongside)}</div>
        <p class="label">Questions for the doctor</p><div class="val q" contenteditable="true" data-k="questions" data-ph="Add your own before sending…">${esc(s.questions)}</div>
      </div>
      <div class="footer"><button class="btn outline" data-a="edit">${S.editing ? 'Done editing' : 'Edit text'}</button>
        <button class="btn" data-a="email">Send by email</button></div>
    </div>${nav('doctor')}`;
  },

  settings() {
    const s = settings();
    return `<div class="screen"><div class="stephead"><button class="back" data-a="go" data-v="home">‹ Back</button></div>
      <h1>Settings</h1>
      <div class="card"><label class="switch"><span>Show “Menstruation” option</span>
        <input type="checkbox" id="menstruation" ${s.menstruation ? 'checked' : ''}></label></div>
      <div class="card"><p class="label">Test data</p>
        <p class="muted small" style="margin-bottom:12px">Fictional entries so you can explore History and the doctor summary.</p>
        <div class="row"><button class="btn" data-a="demo">Load sample data</button>
        <button class="btn outline" data-a="clear">Delete all</button></div></div>
      <p class="muted small">Everything is stored only on this device.</p></div>`;
  }
};

function step(n, title, sub, body, next, back, cta = 'Next') {
  return `<div class="screen">
    <div class="stephead"><button class="back" data-a="go" data-v="${back}">‹ Back</button><span class="progress">Step ${n} of 3</span></div>
    <div class="segs">${[1,2,3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>
    <h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>${body}
    <div class="footer"><button class="btn" data-a="${next === 'save' ? 'save' : 'go'}" data-v="${next}">${cta}</button>
      <button class="skip" data-a="${next === 'save' ? 'save' : 'go'}" data-v="${next}">Skip this step</button></div></div>`;
}

// ---------- AI draft (Cloudflare function → Gemini) ----------
async function draftWithAI(st) {
  S.sum.loading = true;
  try {
    const r = await fetch('/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats: st }), signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (!j.sections || S.editing || !S.sum) throw new Error('skip');
    Object.assign(S.sum, { frequency: j.sections.frequency || S.sum.frequency, intensity: j.sections.intensity || S.sum.intensity,
      alongside: j.sections.alongside || S.sum.alongside, ai: true });
  } catch { /* keep the automatic text */ }
  if (S.sum) S.sum.loading = false;
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
      auto: { sleepMin: f.includes('sleep') ? 320 : 430, screenMin: 380, weather: null } };
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
  if (a === 'chip') {
    const g = el.dataset.g;
    if (SINGLE.includes(g)) D[g] = (g === 'medication' && D[g] === v) ? null : v;
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
    all.push(Object.assign({ id: 'l' + Date.now(), start: startFrom(started) }, rest));
    saveLogs(all); S.draft = blankDraft(); return go('saved');
  }
  if (a === 'edit') { S.editing = !S.editing; return render(); }
  if (a === 'email') {
    const s = S.sum;
    const body = `${s.title}\n\nFrequency: ${s.frequency}\nIntensity & duration: ${s.intensity}\nLogged alongside: ${s.alongside}` +
      (s.questions.trim() ? `\n\nQuestions for the doctor:\n${s.questions.trim()}` : '');
    location.href = `mailto:?subject=${encodeURIComponent('Migraine summary')}&body=${encodeURIComponent(body)}`; return;
  }
  if (a === 'demo') { const rest = read('mc.logs', []).filter(l => !l.demo); saveLogs([...rest, ...demoLogs()]); toast('Sample data loaded'); return; }
  if (a === 'clear') { if (confirm('Delete all migraine entries on this device?')) { saveLogs([]); toast('All entries deleted'); } return; }
});
document.addEventListener('change', e => {
  if (e.target.id === 'menstruation') write('mc.settings', Object.assign(settings(), { menstruation: e.target.checked }));
});
document.addEventListener('input', e => {
  if (e.target.id === 'note') S.draft.note = e.target.value;
  const k = e.target.dataset && e.target.dataset.k;
  if (k && S.sum) S.sum[k] = e.target.innerText;
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
