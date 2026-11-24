// Cloudflare Pages Function: POST /api/transcribe?kind=notes|quotes&mime=audio/webm
// Used only by the facilitator page (/sessao), and only when the participant agreed to audio recording.
// The body is the recording as base64 text. It is passed to Gemini for transcription and never stored.
// The request body for Gemini is built by string concatenation so the large audio string is never parsed
// (the free plan allows very little CPU time per request).

const MODEL_DEFAULT = 'gemini-flash-lite-latest';
const MAX_B64 = 4_000_000; // about 3 MB of audio, several minutes at the bitrate the page uses
const MIMES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac'];
const hits = new Map();

const PROMPTS = {
  notes: 'Transcreve esta gravação em português europeu (pt-PT). É uma sessão de teste de uma app; pode haver duas vozes ' +
    '(facilitador e participante). Escreve só o que foi dito, em frases limpas: tira hesitações e repetições ("hum", "tipo"), ' +
    'mas não resumas, não interpretes e não acrescentes nada. Se houver duas vozes, começa as falas do facilitador com "F:" ' +
    'e as do participante com "P:". Não escrevas nomes de pessoas. Devolve apenas o texto.',
  quotes: 'Transcreve esta gravação em português europeu (pt-PT), palavra a palavra, entre aspas «…», sem corrigir nem resumir. ' +
    'Não escrevas nomes de pessoas. Devolve apenas o texto.'
};

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  const host = new URL(request.url).origin;
  if (origin && origin !== host) return json({ error: 'forbidden' }, 403);
  const apiKey = env.GEMINI_API_KEY || env['Gemini API Key'];
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  const ip = request.headers.get('CF-Connecting-IP') || 'x';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60_000);
  if (recent.length >= 12) return json({ error: 'rate_limited' }, 429);
  hits.set(ip, [...recent, now]);

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') === 'quotes' ? 'quotes' : 'notes';
  const mime = (url.searchParams.get('mime') || 'audio/webm').split(';')[0];
  if (!MIMES.includes(mime)) return json({ error: 'bad_mime' }, 400);

  const b64 = await request.text();
  if (!b64 || b64.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(b64.slice(0, 200))) return json({ error: 'bad_audio' }, 400);

  const body = '{"contents":[{"parts":[{"text":' + JSON.stringify(PROMPTS[kind]) + '},{"inline_data":{"mime_type":"' + mime +
    '","data":"' + b64 + '"}}]}],"generationConfig":{"temperature":0,"maxOutputTokens":2000}}';

  const model = env.GEMINI_MODEL || MODEL_DEFAULT;
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body,
      signal: AbortSignal.timeout(60000)
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
  return json({ text: text.slice(0, 4000) });
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
