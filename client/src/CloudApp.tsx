import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import packageJson from '../package.json';
import { getConfig } from './services/api';
import App from './App';
import { LocaleContext } from './context/localeContext';
import i18n from './i18n';
import {
  getPlainFromStorage,
  LANGUAGE_KEY,
  savePlainToStorage,
} from './services/storage';
import { LocaleType } from './types/general';

const CloudApp = () => {
  const [envConfig, setEnvConfig] = useState({});
  const [locale, setLocale] = useState<LocaleType>(
    (getPlainFromStorage(LANGUAGE_KEY) as LocaleType | null) || 'en',
  );

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
      envConfig,
      setEnvConfig,
      relaunch: () => {},
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
    <LocaleContext.Provider value={localeContextValue}>
      <BrowserRouter>
        <App deviceContextValue={deviceContextValue} />
      </BrowserRouter>
    </LocaleContext.Provider>
  );
};

export default CloudApp;
