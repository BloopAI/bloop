import { createContext } from 'react';

export type DeviceContextType = {
  openFolderInExplorer: (p: string) => void;
  openLink: (p: string) => void;
  chooseFolder: (conf: {
    defaultPath?: string;
    directory?: boolean;
    multiple?: boolean;
  }) => Promise<null | string | string[]>;
  homeDir: string;
  deviceId: string;
  listen: (
    e: string,
    cb: (event: { payload: { message: string } }) => void,
  ) => void;
  os: {
    arch: string;
    type: string;
    platform: string;
    version: string;
  };
  invokeTauriCommand: (c: string, payload?: any) => void;
  release: string;
  apiUrl: string;
  isRepoManagementAllowed: boolean;
  forceAnalytics: boolean;
};

export const DeviceContext = createContext<DeviceContextType>({
  openFolderInExplorer: (p) => {},
  openLink: (p) => {},
  chooseFolder: (conf) => Promise.resolve(null),
  homeDir: '$HOME',
  deviceId: '',
  listen: () => {},
  os: {
    arch: '',
    type: '',
    platform: '',
    version: '',
  },
  invokeTauriCommand: () => {},
  release: '0.0.0',
  apiUrl: '',
  isRepoManagementAllowed: true,
  forceAnalytics: false,
});
