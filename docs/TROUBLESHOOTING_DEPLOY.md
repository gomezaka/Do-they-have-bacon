# Deploy troubleshooting

## Error: Cannot find package gzip-size/index.js

Use v0.17 or newer. This project now includes:

```json
"gzip-size": "7.0.0"
```

and an override for the same package. Then run:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json, .next, .open-next -ErrorAction SilentlyContinue
npm install
npm run deploy
```

If it still fails, run the deploy under Node.js LTS instead of Node 24.


## Error: gzip-size does not provide default export

Use v0.18 or newer. v0.17 added gzip-size v7, but that package version does not provide the default export expected by `@node-minify/utils`.

Then run:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json, .next, .open-next -ErrorAction SilentlyContinue
npm install
npm run deploy
```
