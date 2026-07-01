# Changelog

## v0.16.0
- Fixed Cloudflare/Next build failure on /auth/callback
- Wrapped useSearchParams in Suspense for Next 15 prerendering
- Kept public cleanup from v0.15
- Added ESLint import extension fix for eslint-config-next/core-web-vitals.js

## v0.15.0
- Removed public Local bacon lab and Cloudflare R2 check from the user-facing You page
- Replaced the public You page with a clean scout profile/beta page
- Moved developer tools to /dev
- /dev is disabled unless NEXT_PUBLIC_SHOW_DEV_TOOLS=true
- Removed public links that sent normal users to prototype tooling

## v0.14.0
- Fixed Supabase magic-link redirects using runtime `window.location.origin`
- Updated auth callback to handle code-based Supabase sessions
- Added docs/AUTH_REDIRECTS.md with required Supabase URL settings
- Prevents deployed login links from sending mobile users back to localhost

## v0.13.0
- Applied latest design pass across Search, Add Hotel, Hotel Detail, Report, Map and You screens
- Added real app navigation with center bacon scout action
- Removed remaining mockup wording from the hotel hero
- Improved photo upload card, report choices, segmented date controls and page headers
- Kept working Cloudflare/OpenNext dependency pins from v0.11/v0.12

## v0.12.0
- Removed fake mobile status bar, battery and phone shell
- Updated the app shell to match the latest full-screen mobile web design
- Refreshed the home screen using the latest v0.12 design direction
- Kept the existing Supabase, R2 and Cloudflare deploy setup intact

# Changelog

## v0.11.0 - Cloudflare dependency fix

- Fixed npm dependency conflict from v0.10.
- Updated `next` from `15.5.15` to `15.5.18` to satisfy `@opennextjs/cloudflare@1.20.1` peer requirements.
- Updated `eslint-config-next` to `15.5.18`.
- Keep Next below 16 to avoid the previously observed OpenNext runtime error: `components.ComponentMod.handler is not a function`.

Install/reset commands on Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json, .next, .open-next -ErrorAction SilentlyContinue
npm install
npm run deploy
```


## v0.10.0 - Cloudflare runtime fix

- Pin Next.js to 15.5.15 instead of `latest` to avoid the Cloudflare/OpenNext runtime error `components.ComponentMod.handler is not a function`.
- Pin React, React DOM, OpenNext Cloudflare and Wrangler versions for reproducible deploys.
- Add `npm run clean` to remove `.next` and `.open-next`.
- Add `docs/RUNTIME_FIX_V010.md`.
- Update README with PowerShell cleanup and redeploy steps.

# Changelog

## v0.9.0

Cloudflare deployment cleanup.

Added:

- Cloudflare Workers deployment setup
- OpenNext Cloudflare adapter dependency
- Wrangler dependency
- `wrangler.jsonc`
- `open-next.config.ts`
- `public/_headers`
- `.dev.vars.example`
- `npm run preview`
- `npm run deploy`
- `npm run upload`
- `npm run cf-typegen`
- `docs/DEPLOY_CLOUDFLARE.md`
- `docs/DEPLOY_STATUS.md`

Changed:

- project version set to `0.9.0`
- README rewritten around local testing + Cloudflare deploy
- `.gitignore` now excludes `.open-next`, `.wrangler`, `.dev.vars` and generated Cloudflare env types

Notes:

- This version does not include secret keys.
- This version does not restart the app from scratch.
- The deploy target is Cloudflare Workers via OpenNext, not a plain static Cloudflare Pages export.

## v0.8.0

Anonymous-first update.

- Removed sign-in requirement from reporting
- Removed sign-in requirement from manual hotel creation
- Added anonymous scout ID per browser
- Supabase writes support `anonymous_scout_id`
- R2 upload works for anonymous scouts
- Added basic server-side rate limits
- Login kept as optional future profile feature
