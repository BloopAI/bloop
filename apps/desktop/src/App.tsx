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
import TextInput from '@bloop/client/src/components/TextInput';

function removeHighlights() {
  [...document.getElementsByClassName('search-highlight')].map(
    (n) => n && n.remove(),
  );
}

function highlightSelection() {
  // document.execCommand('HiliteColor', false, color);
  const selection = window.getSelection();
  if (selection) {
    const selectionRange = selection?.getRangeAt(0);
    const rect = selectionRange?.getBoundingClientRect();
    if (rect && rect.width && rect.height) {
      const highlight = document.createElement('div');
      highlight.className = 'search-highlight';
      highlight.style.position = 'fixed';
      highlight.style.top = rect?.top + 'px';
      highlight.style.height = rect?.height + 'px';
      highlight.style.left = rect?.left + 'px';
      highlight.style.width = rect?.width + 'px';
      highlight.style.zIndex = '100';
      highlight.style.backgroundColor = '#AB8800';
      highlight.style.opacity = '0.3';
      document.body.appendChild(highlight);
    }
  }
}

function doSearch(text: string) {
  removeHighlights();
  if (window.find && window.getSelection) {
    document.designMode = 'on';
    const sel = window.getSelection();
    sel?.collapse(document.body, 0);

    while (window.find(text)) {
      highlightSelection();
      sel?.collapseToEnd();
    }
    document.designMode = 'off';
  } else if (document.body.createTextRange) {
    const textRange = document.body.createTextRange();
    while (textRange.findText(text)) {
      highlightSelection();
      textRange.collapse(false);
    }
  }
  document.getElementById('app-search')?.focus();
}

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
  const [searchValue, setSearchValue] = useState('');
  const [isSearchActive, setSearchActive] = useState(false);

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

  useEffect(() => {
    const toggleSearch = (e: KeyboardEvent) => {
      if (e.code === 'KeyF' && e.metaKey) {
        setSearchActive((prev) => !prev);
      } else if (e.code === 'Escape') {
        setSearchActive((prev) => {
          if (prev) {
            e.preventDefault();
          }
          return false;
        });
      }
    };
    window.addEventListener('keypress', toggleSearch);

    return () => {
      window.removeEventListener('keypress', toggleSearch);
    };
  }, []);

  useEffect(() => {
    if (!isSearchActive) {
      removeHighlights();
    }
  }, [isSearchActive]);

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
      {isSearchActive && (
        <div className="fixed top-[66px] right-[5px] z-50 bg-gray-900">
          <TextInput
            type="text"
            id="app-search"
            name="app-search"
            autoFocus
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              doSearch(e.target.value);
            }}
          />
        </div>
      )}
      <ClientApp deviceContextValue={deviceContextValue} />
    </>
  );
}

export default App;
