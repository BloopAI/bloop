import * as path from 'path';
import * as fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import EnvironmentPlugin from 'vite-plugin-environment';

// https://vitejs.dev/config/
export default defineConfig({
  envDir: '../../.',
  plugins: [
    react(),
    reactVirtualized(),
    EnvironmentPlugin(
      {
        ANALYTICS_FE_WRITE_KEY_DEV: '',
        ANALYTICS_FE_WRITE_KEY_PROD: '',
        ANALYTICS_DATA_PLANE_URL: '',
        SENTRY_DSN_FE: '',
        SENTRY_DSN_BE: '',
        ONBOARDING: '',
        API_URL: '',
        DEVICE_ID: '',
      },
      // [
      //   'ANALYTICS_FE_WRITE_KEY_DEV',
      //   'ANALYTICS_FE_WRITE_KEY_PROD',
      //   'ANALYTICS_DATA_PLANE_URL',
      //   'SENTRY_DSN_FE',
      //   'SENTRY_DSN_BE',
      //   'ONBOARDING',
      //   'API_URL',
      //   'DEVICE_ID',
      // ],
      {
        defineOn: 'import.meta.env',
      },
    ),
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

const WRONG_CODE = `import { bpfrpt_proptype_WindowScroller } from "../WindowScroller.js";`;
export function reactVirtualized(): Plugin {
  return {
    name: 'flat:react-virtualized',
    // Note: we cannot use the `transform` hook here
    //       because libraries are pre-bundled in vite directly,
    //       plugins aren't able to hack that step currently.
    //       so instead we manually edit the file in node_modules.
    //       all we need is to find the timing before pre-bundling.
    configResolved() {
      const file = require
        .resolve('react-virtualized')
        .replace(
          path.join('dist', 'commonjs', 'index.js'),
          path.join('dist', 'es', 'WindowScroller', 'utils', 'onScroll.js'),
        );
      const code = fs.readFileSync(file, 'utf-8');
      const modified = code.replace(WRONG_CODE, '');
      fs.writeFileSync(file, modified);
    },
  };
}
