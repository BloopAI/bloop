import React from 'react';
import ReactDOM from 'react-dom/client';
import CloudApp from './CloudApp';
import polyfills from './utils/polyfills';
polyfills();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <CloudApp />
  </React.StrictMode>,
);
