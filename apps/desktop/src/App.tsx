import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api';
import { open } from '@tauri-apps/api/shell';
import { homeDir } from '@tauri-apps/api/path';
import { message, open as openDialog } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import * as tauriOs from '@tauri-apps/api/os';
import { getVersion } from '@tauri-apps/api/app';
import ClientApp from '../../../client/src/App';
import '../../../client/src/index.css';
import {
  DEVICE_ID,
  getPlainFromStorage,
  savePlainToStorage,
} from '../../../client/src/services/storage';
import { generateUniqueId } from '../../../client/src/utils';
import TextSearch from './TextSearch';

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
  const [deviceId, setDeviceId] = useState('');
  const [indexFolder, setIndexFolder] = useState('');
  const [os, setOs] = useState({
    arch: '',
    type: '',
    platform: '',
    version: '',
  });
  const [release, setRelease] = useState('');
  const contentContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    homeDir().then(setHomeDir);
    invoke('get_device_id')
      .then((res) => {
        if (res) {
          setDeviceId(res.toString().trim());
        } else {
          let generatedId = getPlainFromStorage(DEVICE_ID);
          if (!generatedId) {
            generatedId = generateUniqueId();
            savePlainToStorage(DEVICE_ID, generatedId);
          }
          setDeviceId(generatedId);
        }
      })
      .catch(console.log);
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
    if (import.meta.env.SENTRY_DSN_BE) {
      invoke('initialize_sentry', {
        dsn: import.meta.env.SENTRY_DSN_BE,
        environment: import.meta.env.MODE,
      });
    }
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
      deviceId,
      listen,
      os,
      invokeTauriCommand: invoke,
      release,
      apiUrl: 'http://127.0.0.1:7878/api',
      isRepoManagementAllowed: true,
      forceAnalytics: false,
      isSelfServe: false,
      showNativeMessage: message,
    }),
    [homeDirectory, indexFolder, deviceId, os, release],
  );
  return (
    <>
      <TextSearch contentRoot={contentContainer.current} />
      <div ref={contentContainer}>
        <ClientApp deviceContextValue={deviceContextValue} />
      </div>
    </>
  );
}

export default App;
