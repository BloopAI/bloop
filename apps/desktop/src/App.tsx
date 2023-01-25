import React, { useEffect, useMemo, useRef, useState } from 'react';
import ClientApp from '@bloop/client/src/App';
import '@bloop/client/src/index.css';
import { invoke } from '@tauri-apps/api';
import { open } from '@tauri-apps/api/shell';
import { homeDir } from '@tauri-apps/api/path';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import * as tauriOs from '@tauri-apps/api/os';
import { getVersion } from '@tauri-apps/api/app';
import TextSearch from './TextSearch';

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
    });
    if (import.meta.env.VITE_SENTRY_DSN_BE) {
      invoke('initialize_sentry', {
        dsn: import.meta.env.VITE_SENTRY_DSN_BE,
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
