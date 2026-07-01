# Moderation draft

## MVP protections

- No login requirement for normal users
- Local anonymous scout ID per browser
- Basic API rate limits for reports, manual hotels and uploads
- Optional Cloudflare Turnstile for reports/hotels
- Max one photo per report
- Browser-side image compression before upload
- 280 character note limit
- Flag report button later

## Current v0.8 server limits

These are simple in-memory limits in the Next.js server:

```text
reports: 30 per hour per scout/browser identity
manual hotels: 8 per day per scout/browser identity
uploads: 20 per hour per scout/browser identity
```

They are good enough for local/prototype testing. A deployed serverless app should eventually move rate limits to a shared store.

## Suggested production limits

- New anonymous scout: 10 reports/day
- New anonymous scout: 3 manual hotels/day
- Photo max after compression: 500–750 KB
- Hide reports with 3+ flags from status scoring
- Keep audit log for moderation decisions
- Require Turnstile on image upload or repeated actions

## Rule

Users report observations. The app calculates status.

Do not let one user directly set hotel truth.
