# loop.

Your IE lectures, turned into a 5-minute swipeable feed: swipe to learn, swipe to test, swipe to reinforce.

- `/` landing page · `/signup` and `/login` (Supabase email + password) · `/app/` the feed app (logged-in only)
- **Make a feed:** upload a lecture PDF (or paste notes) → `api/generate.js` sends it to Claude → the feed is saved to your account
- **Turn a video into a feed:** paste a YouTube link → `api/video.js` fetches its captions (or the student pastes the transcript) → Claude writes a TL;DR card and one card per idea with a small diagram (steps, timeline, compare or a big stat), quick checks and a "watch this moment" clip
- **Saved per student in Supabase:** feeds, scores, what's left to review, and video recall notes (Row Level Security on every table)

## Set up (about 15 minutes)

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), run it.
3. **Authentication → Sign In / Providers → Email:** turn **off** "Confirm email" if you want students to get straight into the app after signing up. (If you leave it on, the sign-up page tells them to check their inbox.)
4. **Authentication → URL Configuration:** set the Site URL to your Vercel URL.
5. **Project Settings → API:** copy the Project URL and the **publishable (anon)** key. Never use the `service_role` key here.

### 2. Anthropic (Claude)
Create an API key at [platform.claude.com](https://platform.claude.com) and add some credit. Each feed costs roughly $0.05–0.25, and each student can make 10 feeds a day (change with `LOOP_DAILY_FEED_LIMIT`).

### 3. Vercel
Import this repo in Vercel (framework preset: **Other**, no build command) and add these environment variables:

| Name | Value | Secret? |
|---|---|---|
| `SUPABASE_URL` | Supabase Project URL | public |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key | public |
| `ANTHROPIC_API_KEY` | your Claude API key | **secret: server only** |
| `LOOP_DAILY_FEED_LIMIT` | optional, default `10` | – |

The browser only ever gets the two public Supabase values (through `/api/config.js`). The Claude key stays on the server. Don't commit any keys; `.env*` is in `.gitignore`.

### Run locally
```bash
npm install
npx vercel dev
```
(`vercel dev` reads the env vars from `vercel env pull` or a local `.env` file.)

## How it fits together
- `index.html` landing page (the pilot-updates form still goes to the team inbox via FormSubmit)
- `login.html`, `signup.html`, `js/auth-page.js` Supabase Auth
- `app/index.html` the feed engine, demo feed, YouTube clipping, your feeds, generate screen
- `js/supabase.js` the shared browser Supabase client
- `api/generate.js` checks the student's login, rate-limits, calls Claude (`claude-opus-5-5`, structured JSON output), saves the feed with the student's own token so RLS applies
- `api/video.js` YouTube captions → visual video feed (same login, limit and saving as generate)
- `api/_shared.js` login check, daily limit, Claude call and saving, shared by both
- `api/config.js` serves the public Supabase URL + key
- `supabase/schema.sql` tables `feeds`, `attempts`, `notes` with RLS policies on `auth.uid()`
