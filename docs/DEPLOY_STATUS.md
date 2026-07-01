# Deployment status

## Current target

Deploy the app as a Cloudflare Worker using OpenNext.

## Confirmed working before deploy

- Next.js app runs locally
- Supabase database works
- R2 bucket works
- R2 public URL works
- R2 CORS works locally
- Anonymous scout flow works

## v0.9 changes

v0.9 does not rebuild the app from scratch. It only adds the missing deployment layer:

- Cloudflare Workers config
- OpenNext adapter
- Wrangler scripts
- Worker deploy documentation
- production environment variable checklist

## Still required from the user

Cloudflare and Supabase secrets must be entered locally or in the Cloudflare dashboard. They are not included in the zip.
