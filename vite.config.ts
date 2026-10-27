import { defineConfig } from 'vite';

// `base: './'` makes the build work on GitHub Pages under /<repo>/ as well as at a domain root.
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
