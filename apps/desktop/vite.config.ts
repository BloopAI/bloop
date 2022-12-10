import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: '../../client/public',
  define: {
    __APP_SESSION__: (Math.random() * 100000).toString(),
  },
});
