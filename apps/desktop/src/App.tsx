import React, { useEffect, useMemo, useState } from 'react';
import ClientApp from '@bloop/client/src/App';
import '@bloop/client/src/index.css';
import { invoke } from '@tauri-apps/api';
import { open } from '@tauri-apps/api/shell';
import { homeDir } from '@tauri-apps/api/path';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import * as tauriOs from '@tauri-apps/api/os';
import { getVersion } from '@tauri-apps/api/app';

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
  return <ClientApp deviceContextValue={deviceContextValue} />;
}

export default App;
