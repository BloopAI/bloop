import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { invoke } from '@tauri-apps/api';
import { open } from '@tauri-apps/api/shell';
import { homeDir } from '@tauri-apps/api/path';
import { relaunch } from '@tauri-apps/api/process';
import { message, open as openDialog } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import * as tauriOs from '@tauri-apps/api/os';
import { getVersion } from '@tauri-apps/api/app';
import { BrowserRouter } from 'react-router-dom';
import ClientApp from '../../../client/src/App';
import '../../../client/src/index.css';
import useKeyboardNavigation from '../../../client/src/hooks/useKeyboardNavigation';
import { LocaleContext } from '../../../client/src/context/localeContext';
import i18n from '../../../client/src/i18n';
import {
  getPlainFromStorage,
  LANGUAGE_KEY,
  savePlainToStorage,
  USER_FONT_SIZE_KEY,
} from '../../../client/src/services/storage';
import { LocaleType } from '../../../client/src/types/general';
import { DeviceContextProvider } from '../../../client/src/context/providers/DeviceContextProvider';
import TextSearch from './TextSearch';

function App() {
  const [homeDirectory, setHomeDir] = useState('');
  const [indexFolder, setIndexFolder] = useState('');
  const [os, setOs] = useState({
    arch: '',
    type: '',
    platform: '',
    version: '',
  });
  const [release, setRelease] = useState('');
  const contentContainer = useRef<HTMLDivElement>(null);
  const [locale, setLocale] = useState<LocaleType>(
    (getPlainFromStorage(LANGUAGE_KEY) as LocaleType | null) || 'en',
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

  useEffect(() => {
    homeDir().then(setHomeDir);
    Promise.all([
      tauriOs.arch(),
      tauriOs.type(),
      tauriOs.platform(),
      tauriOs.version(),
      getVersion(),
    ]).then(([arch, type, platform, version, appVersion]) => {
      setOs({ arch, type, platform, version });
      setRelease(appVersion);
      // checkUpdateAndInstall(appVersion);
      // intervalId = window.setInterval(
      //   () => checkUpdateAndInstall(appVersion),
      //   1000 * 60 * 60,
      // );
    });
  }, []);

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (
      (e.key === '=' || e.key === '-' || e.key === '0') &&
      (e.metaKey || e.ctrlKey) &&
      !e.shiftKey
    ) {
      const root = document.querySelector(':root');
      if (!root) {
        return;
      }
      const style = window
        .getComputedStyle(root, null)
        .getPropertyValue('font-size');
      const fontSize = parseFloat(style);

      const newFontSize =
        e.key === '0' ? 16 : fontSize + (e.key === '=' ? 1 : -1);
      (root as HTMLElement).style.fontSize = newFontSize + 'px';
      savePlainToStorage(USER_FONT_SIZE_KEY, newFontSize);
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent);

  useEffect(() => {
    const root = document.querySelector(':root');
    if (!root) {
      return;
    }
    const newFontSize = getPlainFromStorage(USER_FONT_SIZE_KEY);
    if (newFontSize) {
      (root as HTMLElement).style.fontSize = newFontSize + 'px';
    }
  }, []);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (!import.meta.env.DEV) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', onContextMenu);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  const deviceContextValue = useMemo(
    () => ({
      openFolderInExplorer: (path: string) => {
        invoke('show_folder_in_finder', { path });
      },
      openLink: (path: string) => {
        open(path);
      },
      homeDir: homeDirectory,
      chooseFolder: openDialog,
      indexFolder,
      setIndexFolder,
      listen,
      os,
      invokeTauriCommand: invoke,
      release,
      apiUrl: 'http://127.0.0.1:7878/api',
      isRepoManagementAllowed: true,
      forceAnalytics: false,
      isSelfServe: false,
      showNativeMessage: message,
      relaunch,
    }),
    [homeDirectory, indexFolder, os, release],
  );

  return (
    <DeviceContextProvider deviceContextValue={deviceContextValue}>
      <LocaleContext.Provider value={localeContextValue}>
        <TextSearch contentRoot={contentContainer.current} />
        <div
          ref={contentContainer}
          className="w-screen h-screen overflow-hidden"
        >
          <BrowserRouter>
            <ClientApp />
          </BrowserRouter>
        </div>
      </LocaleContext.Provider>
    </DeviceContextProvider>
  );
}

export default App;
