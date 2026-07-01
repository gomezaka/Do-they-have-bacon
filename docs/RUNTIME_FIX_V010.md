# v0.10 Cloudflare runtime fix

## Problem

Deploy til Cloudflare Workers gikk gjennom, men siden viste `Internal Server Error`. `wrangler tail` viste:

```text
TypeError: components.ComponentMod.handler is not a function
```

Dette kom etter at `npm install` hentet `next: latest`, som ble Next.js 16.2.9. Builden fullførte, men runtime feilet i Cloudflare/OpenNext.

## Endring

`package.json` er endret fra `latest` til låste versjoner:

```json
"next": "15.5.15",
"react": "19.1.1",
"react-dom": "19.1.1",
"@opennextjs/cloudflare": "1.20.1",
"wrangler": "4.105.0"
```

## Viktig etter oppdatering

Slett gamle installerte pakker og buildmapper før ny installasjon.

PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json, .next, .open-next -ErrorAction SilentlyContinue
npm install
npm run deploy
```

## Kontroll

Etter deploy, sjekk:

```bash
npx wrangler tail do-they-have-bacon
```

Åpne:

```text
https://do-they-have-bacon.dotheyhavebacon.workers.dev
```

Hvis siden fortsatt feiler, kopier første runtime-error fra tail-loggen.
