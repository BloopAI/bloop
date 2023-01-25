import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import EnvironmentPlugin from 'vite-plugin-environment';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    EnvironmentPlugin(
      [
        'ANALYTICS_WRITE_KEY_DEV',
        'ANALYTICS_DATA_PLANE_URL',
        'ANALYTICS_WRITE_KEY_PROD',
        'SENTRY_DSN_FE',
        'SENTRY_DSN_BE',
      ],
      {
        defineOn: 'import.meta.env',
      },
    ),
  ],
  publicDir: '../../client/public',
  define: {
    __APP_SESSION__: (Math.random() * 100000).toString(),
  },
});
