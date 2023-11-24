import { createContext } from 'react';

type ContextType = {
  path: string;
  isFileModalOpen: boolean;
  scrollToLine: string | undefined;
  closeFileModalOpen: (noNavUpdate?: boolean) => void;
  openFileModal: (
    path: string,
    scrollToLine?: string,
    highlightColor?: string,
    noNavUpdate?: boolean,
  ) => void;
  highlightColor?: string;
};

export const FileModalContext = createContext<ContextType>({
  path: '',
  isFileModalOpen: false,
  scrollToLine: undefined,
  closeFileModalOpen: () => {},
  openFileModal: () => {},
  highlightColor: '',
});
