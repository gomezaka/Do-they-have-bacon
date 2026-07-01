# Supabase prototype mode

The app is local-first by default. Supabase mode is optional and is the next step after the browser prototype works.

v0.8 is anonymous-first: app users can add hotels and submit reports without signing in.

## 1. Create a free Supabase project

Create a new Supabase project and open the SQL editor.

For a fresh project, run these files in this order:

```text
supabase/schema.sql
supabase/policies.sql
```

If you already ran the v0.7 schema, run this migration instead:

```text
supabase/migrations/20260630_v08_anonymous_scouts.sql
```

## 2. Create `.env.local`

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
```

Then restart the dev server:

```bash
npm run dev
```

## 3. What this mode does

When `NEXT_PUBLIC_DATA_MODE=supabase`, the browser talks to this app's internal API routes:

```text
GET  /api/hotels
POST /api/hotels
GET  /api/hotels/:id
GET  /api/hotels/duplicates
POST /api/reports
```

Those routes use the server-only Supabase service role key. Anonymous writes are not direct browser inserts; they go through the API route so we can apply rate limits, optional Turnstile and moderation later.

## 4. Anonymous scout IDs

Each browser gets a local ID like:

```text
scout_ab12cd34ef
```

Supabase rows can store this as:

```text
created_by_anonymous_scout_id
anonymous_scout_id
```

This is not a real account. It is only a lightweight anti-spam and future-badges identifier.

## 5. Photo evidence

Photo evidence should use Cloudflare R2. The report stores only `photo_url`, not the full image data.

See:

```text
docs/CLOUDFLARE.md
```
