# Install guide for VSCode

## 1. Install Node.js LTS

Use the LTS version from nodejs.org.

Check installation:

```bash
node -v
npm -v
```

## 2. Open folder in VSCode

Open the `do-they-have-bacon` folder.

## 3. Install dependencies

```bash
npm install
```

## 4. Run development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 5. Test the core flow

1. Go to Add hotel
2. Add a hotel manually
3. Report bacon
4. Open hotel page
5. Open map

## 6. Later: connect Supabase

Use files in `/supabase`:

- `schema.sql`
- `policies.sql`
- `seed.sql`

Then replace `localStorage` operations with Supabase calls.
