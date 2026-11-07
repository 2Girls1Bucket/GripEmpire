import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the build work from any static host sub-path (GitHub Pages, itch.io, Netlify...).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
} as any);
