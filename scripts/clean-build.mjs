import { rmSync, existsSync } from 'node:fs';

const paths = ['.next', '.open-next'];
for (const path of paths) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    console.log(`Removed ${path}`);
  }
}
console.log('Build folders cleaned.');
