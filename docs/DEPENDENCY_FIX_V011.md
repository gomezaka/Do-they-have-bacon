# v0.11 dependency fix

`npm install` failed in v0.10 because `@opennextjs/cloudflare@1.20.1` requires `next >=15.5.18 <16 || >=16.2.6`, while v0.10 pinned `next` to `15.5.15`.

This version pins:

```json
"next": "15.5.18",
"eslint-config-next": "15.5.18",
"@opennextjs/cloudflare": "1.20.1"
```

Do not use `next: latest` for Cloudflare deployment in this project until the OpenNext runtime issue is resolved.

## Windows PowerShell reset

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json, .next, .open-next -ErrorAction SilentlyContinue
npm install
npm run deploy
```
