import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeSentry } from './utils/services';

initializeSentry();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App
      deviceContextValue={{
        openFolderInExplorer: (p) => {},
        openLink: (p) => window.open(p),
        chooseFolder: (conf) => Promise.resolve(null),
        homeDir: '$HOME',
        deviceId: '',
        listen: () => {},
        os: {
          arch: '',
          type: '',
          platform: '',
          version: '',
        },
        invokeTauriCommand: () => {},
      }}
    />
  </React.StrictMode>,
);
