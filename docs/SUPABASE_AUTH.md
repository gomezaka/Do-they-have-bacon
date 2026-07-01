# Supabase Auth setup

Do They Have Bacon? is now anonymous-first.

Users do **not** need to sign in to:

- add hotels
- report bacon
- upload photo evidence
- use the map
- search hotels

Supabase Auth remains optional for later features such as:

- public scout names
- badges
- editing your own reports
- higher trust scores
- moderator tools

## Environment for Supabase data mode

Create `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DATA_MODE=supabase

NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
```

Never commit `.env.local`.

## Anonymous writes

Anonymous writes go through the Next.js API routes. The browser sends a local `anonymousScoutId`; the API route uses the server-side Supabase service role key to insert rows.

This keeps the controlled write path in one place so the app can apply:

- rate limits
- optional Cloudflare Turnstile checks
- image handling
- moderation rules later

## Optional login

Magic-link login still exists at `/login`, but it is no longer required for normal bacon scouting.

If a user is signed in, API routes will attach `user_id` as well as accepting the anonymous scout ID.

## Database update from v0.7

If you already ran the v0.7 schema, run this migration in Supabase SQL Editor:

```text
supabase/migrations/20260630_v08_anonymous_scouts.sql
```

Fresh projects can run:

```text
supabase/schema.sql
supabase/policies.sql
```
