# Cloudflare setup for Do They Have Bacon?

v0.6 adds optional Cloudflare support while keeping local mode free and simple.

Cloudflare is used for two things:

1. **R2**: photo evidence storage.
2. **Turnstile**: bot/spam protection for write actions.

Both are optional. The app still runs locally without Cloudflare.

---

## 1. Cloudflare R2 for photo evidence

### Create bucket

In Cloudflare:

1. Open **R2 Object Storage**.
2. Create a bucket named:

```text
do-they-have-bacon
```

3. Create an R2 API token with **Object Read & Write** permission for only that bucket.
4. Copy the S3 client credentials into `.env.local`.

Use these values:

```env
R2_ACCOUNT_ID=the-part-before-.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=do-they-have-bacon
```

Do not use the Cloudflare API token value that starts with `cfat_` in this app. The app uses the S3 client credentials.

---

## 2. Public URL

`R2_PUBLIC_URL` is required if uploaded images should be visible in the app.

This is **not** the S3 endpoint.

Use either:

```text
r2.dev public bucket URL
```

or a custom domain, for example:

```env
R2_PUBLIC_URL=https://media.example.com
```

If `R2_PUBLIC_URL` is missing, the R2 status tool will show that R2 is not fully ready.

---

## 3. Bucket CORS

The browser uploads directly to R2 with a signed PUT URL. Your bucket must allow PUT from your app domain.

For local testing, allow `http://localhost:3000`.

Example CORS policy:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

When deployed, add your production domain to `AllowedOrigins`.

---

## 4. Local R2 testing without Supabase

v0.6 can test R2 uploads even while data is stored in `localStorage`.

Copy this file:

```text
.env.local.r2.example
```

Rename the copy to:

```text
.env.local
```

Fill in the R2 values and use:

```env
NEXT_PUBLIC_DATA_MODE=local
NEXT_PUBLIC_ENABLE_R2_UPLOADS=true
BACON_ALLOW_LOCAL_R2_UPLOADS=true
```

This lets you test:

```text
manual hotel
↓
bacon report
↓
photo compression
↓
signed R2 upload
↓
local report stores the public R2 photo URL
```

Keep this local-only flag disabled in public deployments:

```env
BACON_ALLOW_LOCAL_R2_UPLOADS=false
```

---

## 5. R2 status tool

After starting the app, open:

```text
http://localhost:3000/tools
```

Use **Check R2 config**.

The tool shows:

```text
configured / not ready
missing env variable names
bucket name
endpoint
public URL
whether local R2 uploads are allowed
```

It never prints secret values.

---

## 6. How uploads work

```text
Photo selected in browser
↓
Compressed in browser
↓
/api/uploads/r2-presign creates a temporary signed R2 PUT URL
↓
Browser uploads directly to R2
↓
Report stores only the public R2 URL
```

If R2 is not configured, the prototype falls back to local data-url storage so local development does not stop.

---

## 7. Cloudflare Turnstile for write protection

Create a Turnstile widget in Cloudflare and add these values:

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key
BACON_ENABLE_TURNSTILE=true
```

When enabled, the API routes for manual hotel creation and bacon reports verify the Turnstile token on the server.

Local mode does not require Turnstile.

---

## 8. Cloudflare deployment later

The app can be developed locally first. When deploying to Cloudflare Pages/Workers, remember to add the same environment variables in the Cloudflare dashboard.

For the MVP, the safest path is:

```text
local mode
↓
R2 local upload test
↓
Supabase mode with Auth
↓
Turnstile on writes
↓
Deploy
```
