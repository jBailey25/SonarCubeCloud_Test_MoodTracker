import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single source of truth for the app version: the Android versionName.
const gradle = fs.readFileSync(path.resolve(__dirname, 'android/app/build.gradle'), 'utf8');
const appVersion = gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? 'dev';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  publicDir: 'public',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
