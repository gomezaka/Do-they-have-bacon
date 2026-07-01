# Deploy Do They Have Bacon? to Cloudflare Workers

This project is a Next.js app with API routes. Deploy it to **Cloudflare Workers with OpenNext**, not as a plain static Pages export.

Cloudflare R2 is still used for photo evidence. Supabase is still used for the database. The Worker is the public website/app server.

## 0. What is already prepared in v0.9

v0.9 includes:

- `@opennextjs/cloudflare` and `wrangler` in `package.json`
- `open-next.config.ts`
- `wrangler.jsonc`
- `public/_headers`
- `.dev.vars.example`
- Cloudflare deploy scripts:
  - `npm run preview`
  - `npm run deploy`
  - `npm run upload`
  - `npm run cf-typegen`

## 1. Install dependencies

From the project root:

```bash
npm install
```

Do not use `npm ci` on this package unless you have regenerated a matching `package-lock.json` after installing the Cloudflare packages.

## 2. Keep local dev working

For normal local development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 3. Optional: preview in Cloudflare Workers runtime

Copy:

```text
.dev.vars.example
```

to:

```text
.dev.vars
```

Fill in the same values you use in `.env.local`.

Then run:

```bash
npm run preview
```

This builds the app and runs it in the Cloudflare Workers runtime locally.

## 4. Login to Cloudflare from VSCode terminal

```bash
npx wrangler login
```

A browser window opens. Accept the Cloudflare authorization.

## 5. Deploy from VSCode terminal

```bash
npm run deploy
```

Cloudflare should return a public URL, usually on a `workers.dev` subdomain.

Example:

```text
https://do-they-have-bacon.<your-account>.workers.dev
```

## 6. Add production environment variables in Cloudflare

In Cloudflare Dashboard:

```text
Workers & Pages
→ do-they-have-bacon
→ Settings
→ Variables and Secrets
```

Add these values. Use your own secrets for the blank fields.

```env
NEXT_PUBLIC_APP_URL=https://your-worker-url.workers.dev
NEXT_PUBLIC_DATA_MODE=supabase

NEXT_PUBLIC_SUPABASE_URL=https://qivsimkychjsknuhhfff.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-or-secret-key

NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org

NEXT_PUBLIC_ENABLE_R2_UPLOADS=true
BACON_ALLOW_LOCAL_R2_UPLOADS=false
R2_ACCOUNT_ID=5f44dac9f8c098cf64000b4f4a80efe4
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=do-they-have-bacon
R2_PUBLIC_URL=https://pub-2e03acbe4ae14fbea6b571d7cd8425cb.r2.dev

NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
BACON_ENABLE_TURNSTILE=false
```

After changing variables, redeploy:

```bash
npm run deploy
```

## 7. Update R2 CORS

Go to:

```text
Cloudflare
→ R2 Object Storage
→ do-they-have-bacon
→ Settings
→ CORS policy
```

Use this, replacing the Worker URL with your real URL:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8787",
      "https://your-worker-url.workers.dev"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

CORS must match the exact origin, including `https` and the domain.

## 8. Test from mobile

Open the Worker URL on your phone.

Test:

```text
Add hotel manually
→ Report bacon
→ take/upload photo
→ submit report
→ open map
```

Then check:

```text
Supabase → Table Editor → hotels / bacon_reports
Cloudflare → R2 → do-they-have-bacon → Objects
```

## 9. If deploy fails

First checks:

- Did you run `npm install` after unpacking v0.9?
- Are `@opennextjs/cloudflare` and `wrangler` installed?
- Did `npm run build` pass?
- Did `npm run preview` pass?
- Did you set environment variables in Cloudflare, not only in `.env.local`?
- Did you update R2 CORS with the deployed Worker URL?

## 10. Important notes

- `.env.local` is for your PC only.
- Cloudflare Worker variables must be added in Cloudflare Dashboard.
- `R2_PUBLIC_URL` is the `pub-...r2.dev` URL, not the S3 endpoint.
- `R2_ACCOUNT_ID` is only the account id, not the full endpoint.
- Login is optional; the main app is anonymous-first.
