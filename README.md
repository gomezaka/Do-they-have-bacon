# Do They Have Bacon? - Netlify PWA

A global hotel breakfast bacon tracker.

This version is rebuilt as a simple installable web app:

```text
Vite + React
Supabase direct database access
Cloudflare R2 photo storage through a Netlify Function
PWA manifest + service worker
Netlify-ready static deploy
```

No Next.js, no OpenNext, no Wrangler, no Cloudflare Workers deploy chain.

## Local setup

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Environment variables

Copy:

```text
.env.example
```

to:

```text
.env.local
```

Fill in:

```env
VITE_APP_URL=http://localhost:5173

VITE_SUPABASE_URL=https://qivsimkychjsknuhhfff.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key

VITE_R2_PUBLIC_URL=https://pub-2e03acbe4ae14fbea6b571d7cd8425cb.r2.dev

R2_ACCOUNT_ID=5f44dac9f8c098cf64000b4f4a80efe4
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=do-they-have-bacon
```

`VITE_` variables are visible in the frontend. R2 secret values are used only by the Netlify Function.

## Supabase

Run:

```text
docs/supabase-schema.sql
```

in Supabase SQL Editor.

This creates:

```text
hotels
bacon_reports
report_flags
```

and public insert/read policies for anonymous beta reporting.

## Netlify deploy

Recommended settings:

```text
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

Or just let Netlify read `netlify.toml`.

Add the same environment variables in Netlify:

```text
Site configuration
-> Environment variables
```

After deploy, update:

```env
VITE_APP_URL=https://your-netlify-site.netlify.app
```

and redeploy.

## R2 CORS

Add your Netlify URL to R2 CORS:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://your-netlify-site.netlify.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Install on mobile

Open the Netlify URL on Android Chrome and choose:

```text
Install app
```

or:

```text
Add to Home screen
```

The app uses `manifest.webmanifest` and `sw.js`, so it behaves like an installable PWA.
