import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import EnvironmentPlugin from 'vite-plugin-environment';

// https://vitejs.dev/config/
export default defineConfig({
  envDir: '../../.',
  plugins: [
    react(),
    EnvironmentPlugin(
      [
        'ANALYTICS_FE_WRITE_KEY_DEV',
        'ANALYTICS_FE_WRITE_KEY_PROD',
        'ANALYTICS_DATA_PLANE_URL',
        'SENTRY_DSN_FE',
        'SENTRY_DSN_BE',
        'ONBOARDING',
        'API_URL',
        'DEVICE_ID',
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
