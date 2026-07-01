# Deploy-sjekkliste for Tribunesliter

## Før deploy

1. Kontroller at `.env.local` finnes lokalt og at Supabase-nøklene fungerer.
2. Kjør:

```bash
npm install
npm run check
npm run build
```

3. Åpne `dist/` via `npm run preview` og test:
   - forside
   - hallprofil
   - innlogging
   - vurdering til moderering
   - rett-info til moderering
   - lagre/fjerne hall
   - del-knapp
   - admin/moderering

## Netlify

Build command:

```bash
npm run build
```

Publish directory:

```text
dist
```

Legg inn miljøvariabler i Netlify:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

`netlify.toml` ligger allerede i prosjektet.

## Vercel

Framework preset: Vite

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Legg inn miljøvariabler i Vercel:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

`vercel.json` ligger allerede i prosjektet.

## Etter deploy

1. Åpne produksjonslenken på mobil.
2. Logg inn med magic link.
3. Send inn testvurdering.
4. Godkjenn i moderatorpanelet.
5. Sjekk at vurderingen vises for andre enheter.
6. Legg appen til på hjemskjermen.
7. Test at appikon og fullskjerm fungerer.
