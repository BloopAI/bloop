import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import packageJson from '../package.json';
import { getConfig } from './services/api';
import App from './App';
import { LocaleContext } from './context/localeContext';

const CloudApp = () => {
  const [envConfig, setEnvConfig] = useState({});
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    setTimeout(() => getConfig().then(setEnvConfig), 1000); // server returns wrong tracking_id within first second
  }, []);

  const deviceContextValue = useMemo(
    () => ({
      openFolderInExplorer: () => {},
      openLink: (p: string) => window.open(p),
      chooseFolder: () => Promise.resolve(null),
      homeDir: '$HOME',
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
      envConfig,
      setEnvConfig,
      relaunch: () => {},
    }),
    [envConfig],
  );

  useEffect(() => {
    // dynamicActivate(locale);
  }, [locale]);

  const localeContextValue = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={localeContextValue}>
      <BrowserRouter>
        <App deviceContextValue={deviceContextValue} />
      </BrowserRouter>
    </LocaleContext.Provider>
  );
};

export default CloudApp;
