# Do They Have Bacon?

> v0.11 fixes the v0.10 dependency conflict: Next.js is pinned to 15.5.18 for `@opennextjs/cloudflare@1.20.1`.


## v0.10 runtime fix

Denne versjonen låser Next.js til 15.5.15 for Cloudflare Workers/OpenNext. v0.9 installerte `next: latest`, som hos deg ble Next.js 16.2.9. Worker-loggen viste `components.ComponentMod.handler is not a function`, som er en runtime-feil i Cloudflare/OpenNext-kjeden, ikke en Supabase- eller R2-nøkkelfeil.

Etter utpakking av v0.10 i VSCode:

```bash
Ctrl + C
rm -rf node_modules package-lock.json .next .open-next
npm install
npm run deploy
```

På Windows PowerShell bruker du heller:

```powershell
Ctrl + C
Remove-Item -Recurse -Force node_modules, package-lock.json, .next, .open-next -ErrorAction SilentlyContinue
npm install
npm run deploy
```

Cloudflare secrets må fortsatt ligge i Worker-en:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` må være ekte Supabase publishable/anon key, ikke placeholder.

---

# Do They Have Bacon?

A mobile-first hotel breakfast bacon tracker. Users can search hotels, add hotels manually, report whether breakfast had bacon, attach photo evidence, and view reported hotels on a bacon map.

## v0.9 Cloudflare-ready update

This version keeps the anonymous-first app from v0.8, but adds the missing deploy layer for Cloudflare Workers.

Added in v0.9:

- Cloudflare Workers deploy setup with OpenNext
- `wrangler.jsonc`
- `open-next.config.ts`
- `public/_headers`
- `.dev.vars.example`
- Cloudflare deploy scripts
- `docs/DEPLOY_CLOUDFLARE.md`
- `docs/DEPLOY_STATUS.md`

The app still works locally with `npm run dev`, and production should be deployed as a **Cloudflare Worker**, not as a plain static export.

## Start locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Useful local test flow

1. Open `/tools`
2. Click **Load demo data**
3. Open `/` or `/map`
4. Add a hotel manually
5. Report bacon without signing in
6. Attach a photo if R2 is configured
7. Open the hotel detail screen

## Environment files

For local testing, create:

```text
.env.local
```

in the same folder as `package.json`.

For R2 testing, copy:

```text
.env.local.r2.example
```

rename the copy to:

```text
.env.local
```

and fill in the values locally.

Do not commit `.env.local`.

## Supabase mode

When switching to Supabase mode, app users still do not need to sign in.

Set:

```env
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

If this is a fresh Supabase setup, run:

```text
supabase/schema.sql
supabase/policies.sql
```

If you already created the v0.7 database schema, run:

```text
supabase/migrations/20260630_v08_anonymous_scouts.sql
```

## Cloudflare deploy

Read this file first:

```text
docs/DEPLOY_CLOUDFLARE.md
```

Short version:

```bash
npm install
npx wrangler login
npm run deploy
```

After deploy, add the Worker URL to R2 CORS.

## Scripts

```bash
npm run dev          # local Next.js dev server
npm run build        # standard Next.js build
npm run preview      # build and preview in Cloudflare Workers runtime
npm run deploy       # build and deploy to Cloudflare Workers
npm run upload       # build and upload a Worker version
npm run cf-typegen   # generate Cloudflare env types
npm run typecheck
npm run lint
```

## Notes

- `R2_PUBLIC_URL` is the `pub-...r2.dev` URL or custom public media domain.
- `R2_PUBLIC_URL` is not the S3 endpoint.
- `R2_ACCOUNT_ID` is only the account ID, not the full endpoint URL.
- Login is optional; the main app is anonymous-first.
- The existing `<img>` warnings are intentional because the prototype avoids paid image optimization/CDN assumptions.


## v0.12 UI refresh
This version removes the fake phone frame and simulated mobile status bar, and uses the newer full-screen mobile web layout from the latest design mockup.


## v0.13 design pass
Search, hotel details, report, map and You/Tools screens were polished to match the latest production-style mobile web design. The fake phone shell remains removed.


## v0.14 auth redirect fix
Magic-link sign-in now uses the actual browser origin instead of relying on a build-time `NEXT_PUBLIC_APP_URL`. Configure Supabase Auth URL settings as described in `docs/AUTH_REDIRECTS.md`.


## v0.15 public cleanup
The public You page no longer shows Local bacon lab, R2 checks or internal data-mode tools. Developer tools have moved to `/dev` and are disabled unless `NEXT_PUBLIC_SHOW_DEV_TOOLS=true` is set.

For production/Cloudflare deploy, keep:

```env
NEXT_PUBLIC_SHOW_DEV_TOOLS=false
```


## v0.16 auth callback build fix
This version fixes the Next.js build failure on `/auth/callback` by wrapping the `useSearchParams()` usage in a `Suspense` boundary.


## v0.17 Cloudflare dependency hotfix
If deploy fails with `Cannot find package ... node_modules/gzip-size/index.js`, use this version. It adds `gzip-size@7.0.0` explicitly because OpenNext/Cloudflare's minify dependency chain can fail to resolve it on clean Windows installs.


## v0.18 gzip-size compatibility fix

If deploy fails with:

```text
SyntaxError: The requested module 'gzip-size' does not provide an export named 'default'
```

use v0.18 or newer. This pins `gzip-size` to `5.1.1`, which is compatible with the import style used in the Cloudflare/OpenNext minify dependency chain on this Windows setup.
