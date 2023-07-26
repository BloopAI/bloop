import React from 'react';
import ReactDOM from 'react-dom/client';
import polyfills from '../../../client/src/utils/polyfills';
import App from './App';
polyfills();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
