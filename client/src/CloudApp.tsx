import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import packageJson from '../package.json';
import App from './App';
import { LocaleContext } from './context/localeContext';
import i18n from './i18n';
import './index.css';
import {
  getPlainFromStorage,
  LANGUAGE_KEY,
  savePlainToStorage,
} from './services/storage';
import { LocaleType } from './types/general';
import { DeviceContextProvider } from './context/providers/DeviceContextProvider';
import { EnvContext } from './context/envContext';
import { getConfig, initApi } from './services/api';
import { useComponentWillMount } from './hooks/useComponentWillMount';

const CloudApp = () => {
  useComponentWillMount(() => initApi('/api', true));
  const [envConfig, setEnvConfig] = useState({});
  const [locale, setLocale] = useState<LocaleType>(
    (getPlainFromStorage(LANGUAGE_KEY) as LocaleType | null) || 'en',
  );

  useEffect(() => {
    getConfig().then(setEnvConfig);
    setTimeout(() => getConfig().then(setEnvConfig), 1000);
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
      invokeTauriCommand: () => Promise.resolve(''),
      release: packageJson.version,
      apiUrl: import.meta.env.API_URL || '/api',
      isRepoManagementAllowed: true,
      isSelfServe: true,
      forceAnalytics: true,
      showNativeMessage: alert,
      relaunch: () => {},
    }),
    [],
  );
  const envContextValue = useMemo(
    () => ({
      envConfig,
      setEnvConfig,
    }),
    [envConfig],
  );

  useEffect(() => {
    i18n.changeLanguage(locale);
    savePlainToStorage(LANGUAGE_KEY, locale);
  }, [locale]);

  const localeContextValue = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale],
  );

  return (
    <DeviceContextProvider
      deviceContextValue={deviceContextValue}
      envConfig={envConfig}
    >
      <EnvContext.Provider value={envContextValue}>
        <LocaleContext.Provider value={localeContextValue}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </LocaleContext.Provider>
      </EnvContext.Provider>
    </DeviceContextProvider>
  );
};

export default CloudApp;
