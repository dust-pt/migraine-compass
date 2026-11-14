// Cloudflare Pages Function: POST /api/summary
// Turns aggregated counts (never raw notes) into a short doctor-friendly summary using Gemini.
// Set GEMINI_API_KEY as an encrypted environment variable in the Pages project. Never commit it.

const MODEL_DEFAULT = 'gemini-3.8-flash';
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

  let stats;
  try { ({ stats } = await request.json()); } catch { return json({ error: 'bad_request' }, 400); }
  if (!stats || typeof stats !== 'object' || JSON.stringify(stats).length > 4000) return json({ error: 'bad_request' }, 400);

  const prompt =
    'You help a patient prepare for a doctor visit. From these migraine statistics, write a clear summary ' +
    'in plain English, max 120 words, no diagnosis, no advice, no invented facts. Mention frequency, ' +
    'average intensity, medication use, most frequent factors and what helped. Statistics (JSON):\n' +
    JSON.stringify(stats);

  const model = env.GEMINI_MODEL || MODEL_DEFAULT;
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 400 } }),
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
  return json({ text });
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// TEMPORARY diagnostic (remove after use): GET /api/summary lists models visible to the key.
export async function onRequestGet({ env }) {
  const apiKey = env.GEMINI_API_KEY || env['Gemini API Key'];
  if (!apiKey) return json({ error: 'not_configured' }, 503);
  const t = Date.now();
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
      headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(8000)
    });
    const j = await r.json();
    return json({ status: r.status, ms: Date.now() - t, error: j.error?.message?.slice(0, 200),
      models: (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', '')) });
  } catch (e) { return json({ error: 'timeout_or_network', ms: Date.now() - t }, 504); }
}
