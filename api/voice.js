// POST /api/voice — a natural, human-sounding voice-over for one animated explainer.
// All of the concept's narration lines are read in ONE take, so the voice flows from scene to scene;
// the app then moves the scenes along in time with the audio.
//
// Body (JSON): { lines: ["narration of scene 1", "scene 2", ...], lang? }
// Header:      Authorization: Bearer <Supabase access token of the logged-in student>
// Returns:     audio/wav (16 kHz mono), or a JSON error — the app then falls back to the phone's own voice.

import { requireUser, clean, readBody } from './_shared.js';

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
const VOICE = process.env.GEMINI_TTS_VOICE || 'Puck'; // "Upbeat"
const DAILY_VOICES = Number(process.env.LOOP_DAILY_VOICE_LIMIT || 80);
const STYLE = 'Natural, warm and energetic, like a friendly university student explaining a topic to camera on TikTok. Conversational pace, smooth flow between sentences, never robotic.';

// Finds the base64 audio in the response, wherever it sits.
function findAudio(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (node.type === 'audio' && typeof node.data === 'string') return node.data;
  if (node.inlineData?.data) return node.inlineData.data;
  if (node.output_audio?.data) return node.output_audio.data;
  for (const v of Array.isArray(node) ? node : Object.values(node)) {
    const found = findAudio(v, depth + 1);
    if (found) return found;
  }
  return null;
}

// Raw 16-bit PCM → a playable WAV file.
function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export default async function handler(req, res) {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return res.status(503).json({ error: 'No AI voice configured.' });

  const auth = await requireUser(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const body = readBody(req);
  const lines = (Array.isArray(body.lines) ? body.lines : []).slice(0, 7).map((l) => clean(l, 220)).filter(Boolean);
  const text = lines.join('\n\n');
  if (!text) return res.status(400).json({ error: 'Nothing to read.' });

  // Cost guard: at most DAILY_VOICES voice-overs per student per 24 hours.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase.from('voice_uses').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if (countError) { console.error('voice_uses check failed', countError.message); return res.status(503).json({ error: 'AI voice not set up.' }); }
  if ((count ?? 0) >= DAILY_VOICES) return res.status(429).json({ error: 'Daily AI voice limit reached.' });

  let r, json;
  try {
    r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: STYLE }] }] }],
        response_format: { type: 'audio', mime_type: 'audio/l16', sample_rate: 16000 },
        generation_config: { speech_config: [{ voice: VOICE }] },
      }),
      signal: AbortSignal.timeout(50000),
    });
    json = await r.json().catch(() => null);
  } catch (err) {
    console.error('Gemini TTS request failed', err?.message);
    return res.status(502).json({ error: 'AI voice unavailable.' });
  }
  const data = r.ok && findAudio(json);
  if (!data) {
    console.error('Gemini TTS error', r.status, JSON.stringify(json)?.slice(0, 500));
    return res.status(r.status === 429 ? 429 : 502).json({ error: 'AI voice unavailable.', status: r.status });
  }

  let audio = Buffer.from(data, 'base64');
  if (audio.subarray(0, 4).toString() !== 'RIFF') audio = wav(audio, 16000); // raw PCM → WAV

  await supabase.from('voice_uses').insert({});
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  return res.status(200).send(audio);
}
