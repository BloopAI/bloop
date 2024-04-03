import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import EnvironmentPlugin from 'vite-plugin-environment';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true, // Source map generation must be turned on
  },
  envDir: '../.',
  plugins: [
    react(),
    EnvironmentPlugin(
      {
        ONBOARDING: '',
        API_URL: '',
      },
      {
        defineOn: 'import.meta.env',
      },
    ),
  ],
  define: {
    __APP_SESSION__: (Math.random() * 100000).toString(),
  },
});
