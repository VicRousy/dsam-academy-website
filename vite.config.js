import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [{
    name: 'copy-browser-scripts',
    writeBundle() {
      const output = resolve('dist/js');
      mkdirSync(output, { recursive: true });
      copyFileSync(resolve('js/site-config.js'), resolve(output, 'site-config.js'));
      copyFileSync(resolve('js/main.js'), resolve(output, 'main.js'));
    },
  }],
});
