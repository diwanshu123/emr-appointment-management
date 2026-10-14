import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API and websocket are proxied, so the browser sees ONE origin.
// That keeps the httpOnly refresh cookie first-party and avoids CORS in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
});
