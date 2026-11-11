// Drives /login and /signup. The page sets <body data-mode="login|signup">.
import { supabase, configured, currentUser } from './supabase.js';

const mode = document.body.dataset.mode;
const form = document.getElementById('authForm');
const email = document.getElementById(mode + '-email');
const password = document.getElementById(mode + '-password');
const submit = document.getElementById(mode + '-submit');
const msg = document.getElementById('msg');
const next = new URLSearchParams(location.search).get('next');
const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app/';

function say(text, ok) { msg.textContent = text; msg.classList.toggle('ok', !!ok); }

if (!configured) {
  say('loop. isn’t connected to its database yet. Ask the team to set the Supabase environment variables.');
} else {
  if (await currentUser()) location.replace(target);
  submit.disabled = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!configured) return;
  const em = email.value.trim(), pw = password.value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return say('Type a valid email address.');
  if (pw.length < 8) return say('Your password needs at least 8 characters.');

  submit.disabled = true;
  const label = submit.textContent;
  submit.textContent = mode === 'signup' ? 'creating your account…' : 'logging in…';
  say('');

  const { data, error } = mode === 'signup'
    ? await supabase.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: location.origin + '/app/' } })
    : await supabase.auth.signInWithPassword({ email: em, password: pw });

  if (error) {
    submit.disabled = false; submit.textContent = label;
    if (/invalid login/i.test(error.message)) return say('Wrong email or password.');
    if (/already registered/i.test(error.message)) return say('That email already has an account. Log in instead.');
    return say(error.message);
  }
  if (data.session) return location.replace(target);
  // Email confirmation is still switched on in Supabase: tell the student to check their inbox.
  submit.textContent = label;
  say('Check your inbox to confirm your email, then log in.', true);
});
