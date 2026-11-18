// Cloudflare Pages Function: POST /api/summary
// Turns aggregated counts (never raw notes) into a short doctor-friendly summary using Gemini.
// Set GEMINI_API_KEY as an encrypted environment variable in the Pages project. Never commit it.

const MODEL_DEFAULT = 'gemini-flash-lite-latest';
const hits = new Map(); // best-effort per-isolate rate limit

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  const host = new URL(request.url).origin;
  if (origin && origin !== host) return json({ error: 'forbidden' }, 403);
  const apiKey = env.GEMINI_API_KEY || env['Gemini API Key'];
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  const ip = request.headers.get('CF-Connecting-IP') || 'x';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60_000);
  if (recent.length >= 5) return json({ error: 'rate_limited' }, 429);
  hits.set(ip, [...recent, now]);

  let stats, lang;
  try { ({ stats, lang } = await request.json()); } catch { return json({ error: 'bad_request' }, 400); }
  if (!stats || typeof stats !== 'object' || JSON.stringify(stats).length > 4000) return json({ error: 'bad_request' }, 400);

  const prompt =
    'You help a patient prepare for a doctor visit. From these migraine statistics, write three short sections in plain ' +
    (lang === 'pt' ? 'European Portuguese (pt-PT, not Brazilian Portuguese), ' : 'English, ') + 'one sentence each, no diagnosis, no advice, no invented facts, and keep every number exactly as given. ' +
    'Return JSON with keys "frequency" (how many and how recent), "intensity" (usual intensity range out of 10 and, if given, ' +
    'duration in hours), and "alongside" (the most logged factors with their counts, e.g. "Slept under 6 h (6×)", keeping the factor names as given). Statistics:\n' +
    JSON.stringify(stats);

  const model = env.GEMINI_MODEL || MODEL_DEFAULT;
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 400, responseMimeType: 'application/json' } }),
      signal: AbortSignal.timeout(20000)
    });
  } catch { return json({ error: 'timeout' }, 504); }
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json())?.error?.message || ''; } catch { /* ignore */ }
    return json({ error: 'upstream', status: r.status, detail: detail.slice(0, 200) }, 502);
  }
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim();
  if (!text) return json({ error: 'empty' }, 502);
  let sections;
  try { sections = JSON.parse(text); } catch { return json({ error: 'bad_json' }, 502); }
  const clean = v => typeof v === 'string' ? v.trim().slice(0, 300) : '';
  return json({ sections: { frequency: clean(sections.frequency), intensity: clean(sections.intensity), alongside: clean(sections.alongside) } });
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
