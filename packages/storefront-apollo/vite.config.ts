import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// vite.config.ts — Vite build and dev-server configuration for the Apollo storefront.
// Docs: https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Enables React Fast Refresh in dev mode and the automatic JSX runtime for production builds.
    react(),
  ],
  resolve: {
    alias: {
      // Map '@' to the project's src/ directory so imports like '@/components/Foo'
      // work from anywhere in the tree without fragile relative paths.
      '@': path.resolve(__dirname, './src'),
    },
  },
});
