import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  useComponentWillMount(() => initApi(import.meta.env.API_URL || '/api', true));
  const [envConfig, setEnvConfig] = useState({});
  const [locale, setLocale] = useState<LocaleType>(
    (getPlainFromStorage(LANGUAGE_KEY) as LocaleType | null) || 'en',
  );

  useEffect(() => {
    getConfig().then(setEnvConfig);
    setTimeout(() => getConfig().then(setEnvConfig), 1000);
  }, []);

  const inputRef = useRef(null);
  const handleChooseFolder = (options) => {
    return new Promise((resolve, reject) => {
      if (inputRef.current) {
        const handleFolderChange = (event) => {
          const file = event.target.files[0];
          if (file) {
            const folderPath = file.webkitRelativePath.split('/').slice(0, -1).join('/');
            resolve(folderPath);
          } else {
            reject(new Error('No folder selected'));
          }
        };

        inputRef.current.addEventListener('change', handleFolderChange, { once: true });
        inputRef.current.click();
      } else {
        reject(new Error('Input element not found'));
      }
    });
  };



  const deviceContextValue = useMemo(
    () => ({
      openFolderInExplorer: () => {},
      openLink: (p: string) => window.open(p),
      //chooseFolder: () => Promise.resolve(null),
      //chooseFolder: YourComponent.handleChooseFolder,
      chooseFolder: handleChooseFolder,
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
            <input
              type="file"
              ref={inputRef}
              webkitdirectory
              style={{ display: 'none' }}
            />
          </BrowserRouter>
        </LocaleContext.Provider>
      </EnvContext.Provider>
    </DeviceContextProvider>
  );
};

export default CloudApp;


