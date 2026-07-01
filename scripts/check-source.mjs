import fs from 'node:fs';

const required = [
  'package.json',
  'vite.config.js',
  'index.html',
  'src/App.jsx',
  'src/main.jsx',
  'src/styles.css',
  'public/manifest.webmanifest',
  'public/sw.js',
  'netlify/functions/r2-presign.js'
];

const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error('Missing files:', missing.join(', '));
  process.exit(1);
}

console.log('Source check OK');
