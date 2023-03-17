import React from 'react';
import ReactDOM from 'react-dom/client';
import packageJson from '../package.json';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App
      deviceContextValue={{
        openFolderInExplorer: (p) => {},
        openLink: (p) => window.open(p),
        chooseFolder: (conf) => Promise.resolve(null),
        homeDir: '$HOME',
        deviceId: import.meta.env.DEVICE_ID || '',
        listen: () => {},
        os: {
          arch: '',
          type: '',
          platform: '',
          version: '',
        },
        invokeTauriCommand: () => {},
        release: packageJson.version,
        apiUrl: import.meta.env.API_URL || '/api',
        isRepoManagementAllowed: true,
        isSelfServe: true,
        forceAnalytics: true,
        showNativeMessage: alert,
      }}
    />
  </React.StrictMode>,
);
