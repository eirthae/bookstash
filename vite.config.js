import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built assets load from file:// inside the Android APK.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist' },
});
