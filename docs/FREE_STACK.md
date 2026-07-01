# Free-stack notes

## Chosen MVP stack

- Next.js + TypeScript
- Leaflet + OpenStreetMap-compatible tiles
- LocalStorage prototype first
- Supabase Free later for database/auth
- Cloudflare R2 Free later for image storage
- Cloudflare Turnstile Free later for spam protection

## What we avoid

- Google Places
- Google Maps
- Mapbox paid usage
- Paid image transformations
- Paid hosting assumptions

## Open map data warning

Public open geocoding services should be used gently. Do not search on every keystroke. Cache results and move to a better/self-hosted solution if the app grows.

## Production map warning

The MVP uses public OpenStreetMap tiles for local development. For production traffic, use an appropriate free tile provider, a cached tile strategy, or a self-hosted/open tile service.
