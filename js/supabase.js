// Shared Supabase client for the browser. The page must load /api/config first,
// which sets window.LOOP_CONFIG with the public Supabase URL and publishable key.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const cfg = window.LOOP_CONFIG || {};
export const configured = Boolean(cfg.supabaseUrl && cfg.supabaseKey);
export const supabase = configured ? createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;

export async function currentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export async function accessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function logout() {
  if (supabase) await supabase.auth.signOut();
  location.href = '/';
}
