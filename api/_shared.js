// Helpers shared by /api/generate and /api/video. Files starting with "_" are not deployed as routes.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const MODEL = 'claude-opus-5-5';
const DAILY_LIMIT = Number(process.env.LOOP_DAILY_FEED_LIMIT || 10);

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

export const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function readBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}

// A Supabase client that acts as the logged-in student, so Row Level Security applies to every query.
function supabaseFor(token) {
  // Accept the project URL with or without a trailing slash or /rest/v1 path.
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Checks the method and the login. Returns { supabase, user } acting as the student,
// or null after it has already sent the error response.
export async function requireUser(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Use POST.' });
    return null;
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'Please log in first.' }); return null; }

  const supabase = supabaseFor(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) { res.status(401).json({ error: 'Your session expired. Please log in again.' }); return null; }
  return { supabase, user: userData.user };
}

// Checks method, login and the daily feed limit. Returns the student's Supabase client,
// or null after it has already sent the error response.
export async function startFeedRequest(req, res) {
  const auth = await requireUser(req, res);
  if (!auth) return null;
  const { supabase } = auth;

  // Simple cost guard: at most DAILY_LIMIT generated feeds per student per 24 hours.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase.from('feeds').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if (countError) { res.status(500).json({ error: 'Could not check your account. Try again in a minute.' }); return null; }
  if ((count ?? 0) >= DAILY_LIMIT) { res.status(429).json({ error: `You’ve made ${DAILY_LIMIT} feeds in the last 24 hours. Come back tomorrow for more.` }); return null; }
  return supabase;
}

// Asks Claude for JSON matching `schema`. Returns the parsed object, or null after sending the error response.
export async function askClaude(res, { system, schema, content, unreadable, effort = 'medium', maxTokens = 16000 }) {
  let message;
  try {
    message = await anthropic.beta.messages
      .stream({
        model: MODEL,
        max_tokens: maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default', // if the model declines, the API retries on a fallback model in the same call
        output_config: { effort, format: { type: 'json_schema', schema } },
        system,
        messages: [{ role: 'user', content }],
      })
      .finalMessage();
  } catch (err) {
    console.error('Claude request failed', err?.status, err?.message);
    if (err instanceof Anthropic.RateLimitError) res.status(503).json({ error: 'loop. is busy right now. Try again in a minute.' });
    else if (err instanceof Anthropic.BadRequestError) res.status(400).json({ error: unreadable || 'We couldn’t read that material.' });
    else res.status(502).json({ error: 'Something went wrong building your feed. Try again.' });
    return null;
  }
  if (message.stop_reason === 'refusal') { res.status(422).json({ error: 'We couldn’t build a feed from that material.' }); return null; }
  if (message.stop_reason === 'max_tokens') { res.status(422).json({ error: 'That material was too long to finish. Try something shorter.' }); return null; }
  try {
    return JSON.parse(message.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  } catch {
    res.status(502).json({ error: 'Something went wrong building your feed. Try again.' });
    return null;
  }
}

// Saves the feed as the student and sends it back.
export async function saveFeed(res, supabase, { title, source, cards }) {
  const { data: feed, error } = await supabase
    .from('feeds')
    .insert({ title, source, cards })
    .select('id, title, source, cards, created_at')
    .single();
  if (error) {
    console.error('Saving feed failed', error.message);
    return res.status(500).json({ error: 'Your feed was built but couldn’t be saved. Try again.' });
  }
  return res.status(200).json({ feed });
}
