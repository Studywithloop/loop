// GET /api/config — hands the browser the two PUBLIC Supabase values (URL + publishable/anon key).
// Nothing secret is ever sent from here: no service_role key, no AI key.
export default function handler(req, res) {
  // Accept the project URL with or without a trailing slash or /rest/v1 path.
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send(`window.LOOP_CONFIG = ${JSON.stringify({ supabaseUrl: url, supabaseKey: key })};`);
}
