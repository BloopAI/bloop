import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence } from 'framer-motion';
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
import { getConfig, initApi } from '../../../client/src/services/api';
import { LocaleContext } from '../../../client/src/context/localeContext';
import i18n from '../../../client/src/i18n';
import {
  getPlainFromStorage,
  LANGUAGE_KEY,
  savePlainToStorage,
  USER_FONT_SIZE_KEY,
} from '../../../client/src/services/storage';
import { LocaleType } from '../../../client/src/types/general';
import { polling } from '../../../client/src/utils/requestUtils';
import ReportBugModal from '../../../client/src/components/ReportBugModal';
import { UIContext } from '../../../client/src/context/uiContext';
import { DeviceContextProvider } from '../../../client/src/context/providers/DeviceContextProvider';
import { EnvContext } from '../../../client/src/context/envContext';
import TextSearch from './TextSearch';
import SplashScreen from './SplashScreen';

// let askedToUpdate = false;
// let intervalId: number;

// listen(
//   'tauri://update-status',
//   async function (res: { payload: { status: string; error: Error | null } }) {
//     if (res.payload.status === 'DONE') {
//       const agreedToRestart = await ask(
//         `The installation was successful, do you want to restart the application now?`,
//         {
//           title: 'Ready to Restart',
//         },
//       );
//       if (agreedToRestart) {
//         relaunch();
//       }
//     } else if (res.payload.status === 'ERROR') {
//       await message(
//         'There was a problem updating bloop' +
//           (res.payload.error?.message || res.payload.error),
//         {
//           title: 'Update failed to install',
//           type: 'error',
//         },
//       );
//     }
//   },
// );

// const checkUpdateAndInstall = async (currentVersion: string) => {
//   try {
//     if (askedToUpdate) {
//       return;
//     }
//     const { shouldUpdate, manifest } = await checkUpdate();
//     if (shouldUpdate) {
//       const agreedToUpdate = await ask(
//         `bloop ${manifest?.version} is now available -- you have ${currentVersion}
//
// Would you like to install it now?
//
// Release notes:
// ${manifest?.body}`,
//         {
//           title: 'A new version of bloop is available!',
//         },
//       );
//       askedToUpdate = true;
//       if (intervalId) {
//         clearInterval(intervalId);
//       }
//       if (agreedToUpdate) {
//         installUpdate();
//       }
//     }
//   } catch (error) {
//     console.log(error);
//   }
// };
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
  const [envConfig, setEnvConfig] = useState({});
  const [locale, setLocale] = useState<LocaleType>(
    (getPlainFromStorage(LANGUAGE_KEY) as LocaleType | null) || 'en',
  );
  const [shouldShowSplashScreen, setShouldShowSplashScreen] = useState(true);
  const [isBugReportModalOpen, setBugReportModalOpen] = useState(false);
  const [serverCrashedMessage, setServerCrashedMessage] = useState('');

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
    listen('server-crashed', (event) => {
      console.log(event);
      setBugReportModalOpen(true);
      // @ts-ignore
      setServerCrashedMessage(event.payload.message);
    });

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
      (e.metaKey || e.ctrlKey)
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
    let intervalId: number;
    if (!Object.keys(envConfig).length) {
      initApi('http://127.0.0.1:7878/api');
      intervalId = polling(() => getConfig().then(setEnvConfig), 500);
    } else {
      // just in case config changed
      setTimeout(() => {
        getConfig().then((resp) =>
          setEnvConfig((prev) =>
            JSON.stringify(prev) === JSON.stringify(resp) ? prev : resp,
          ),
        );
      }, 1000);
      setShouldShowSplashScreen(false);
    }
    return () => {
      window.clearInterval(intervalId);
    };
  }, [envConfig]);

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

  const envContextValue = useMemo(
    () => ({
      envConfig,
      setEnvConfig,
    }),
    [envConfig],
  );

  const bugReportContextValue = useMemo(
    () => ({
      isBugReportModalOpen,
      setBugReportModalOpen,
      activeTab: '',
    }),
    [isBugReportModalOpen],
  );

  return (
    <DeviceContextProvider
      deviceContextValue={deviceContextValue}
      envConfig={envConfig}
    >
      <EnvContext.Provider value={envContextValue}>
        <LocaleContext.Provider value={localeContextValue}>
          <AnimatePresence initial={false}>
            {shouldShowSplashScreen && <SplashScreen />}
          </AnimatePresence>
          {shouldShowSplashScreen && (
            <UIContext.BugReport.Provider value={bugReportContextValue}>
              <ReportBugModal errorBoundaryMessage={serverCrashedMessage} />
            </UIContext.BugReport.Provider>
          )}
          <TextSearch contentRoot={contentContainer.current} />
          <div
            ref={contentContainer}
            className="w-screen h-screen overflow-hidden"
          >
            <BrowserRouter>
              {!shouldShowSplashScreen && <ClientApp />}
            </BrowserRouter>
          </div>
        </LocaleContext.Provider>
      </EnvContext.Provider>
    </DeviceContextProvider>
  );
}

export default App;
