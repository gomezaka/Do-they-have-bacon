# Auth redirects

The deployed app must redirect Supabase magic links back to the public Worker URL, not localhost.

Current public app URL:

```text
https://do-they-have-bacon.dotheyhavebacon.workers.dev
```

Supabase dashboard settings:

```text
Authentication
→ URL Configuration
```

Set:

```text
Site URL:
https://do-they-have-bacon.dotheyhavebacon.workers.dev
```

Add redirect URLs:

```text
https://do-they-have-bacon.dotheyhavebacon.workers.dev/auth/callback
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
```

v0.14 also changes the client to use `window.location.origin` for magic-link redirects. That prevents a local `.env.local` value from being baked into the deployed app.
