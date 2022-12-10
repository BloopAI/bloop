import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeSentry } from '@bloop/client/src/utils/services';
import App from './App';

initializeSentry();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
