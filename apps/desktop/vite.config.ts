import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envVars = loadEnv(mode, process.cwd());
  if (mode === 'production' && !envVars?.VITE_SEGMENT_WRITE_KEY_PROD) {
    throw new Error('Segment key must be present in .env file');
  }
  return {
    plugins: [react()],
    publicDir: '../../client/public',
    define: {
      __APP_SESSION__: (Math.random() * 100000).toString(),
    },
  };
});
