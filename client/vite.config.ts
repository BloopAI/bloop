import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import EnvironmentPlugin from 'vite-plugin-environment';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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
        API_URL: 'http://localhost:7878/api',
      },
      {
        defineOn: 'import.meta.env',
      },
    ),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: 'bloop-yr',
            project: 'bloop-frontend',
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              assets: './dist/**',
            },
            release: process.env.SENTRY_RELEASE_VERSION,
          }),
        ]
      : []),
  ],
  define: {
    __APP_SESSION__: (Math.random() * 100000).toString(),
  },
  server: {
    host: '0.0.0.0', // 设置服务器监听所有的IP地址
  },
});
