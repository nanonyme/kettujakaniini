import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });

await esbuild.build({
  entryPoints: ['src/game.ts'],
  bundle: true,
  minify: true,
  outfile: 'dist/game.js',
  target: ['es2020'],
  format: 'iife',
});

for (const f of ['index.html', 'style.css', 'privacy.html']) {
  copyFileSync(f, `dist/${f}`);
}

console.log('Build complete → dist/');
