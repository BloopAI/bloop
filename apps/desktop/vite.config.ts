import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import EnvironmentPlugin from 'vite-plugin-environment';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true, // Source map generation must be turned on
  },
  envDir: '../../.',
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
    sentryVitePlugin({
      org: 'bloop-yr',
      project: 'bloop-frontend',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist/**',
      },
      release: process.env.SENTRY_RELEASE_VERSION,
    }),
  ],
  publicDir: '../../client/public',
  define: {
    __APP_SESSION__: (Math.random() * 100000).toString(),
  },
  server: {
    fs: {
      strict: false,
    },
  },
});
