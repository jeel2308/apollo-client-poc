import { defineConfig } from 'vite';
import relay from 'vite-plugin-relay';
import react from '@vitejs/plugin-react';
import path from 'path';

// relay MUST come before react() — it transforms graphql`` tags before Babel/JSX.
export default defineConfig({
  plugins: [
    relay,
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
