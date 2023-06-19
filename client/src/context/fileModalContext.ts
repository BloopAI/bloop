import { createContext, Dispatch, SetStateAction } from 'react';

type ContextType = {
  path: string;
  isFileModalOpen: boolean;
  scrollToLine: string | undefined;
  setIsFileModalOpen: Dispatch<SetStateAction<boolean>>;
  openFileModal: (
    path: string,
    scrollToLine?: string,
    highlightColor?: string,
  ) => void;
  highlightColor?: string;
};

export const FileModalContext = createContext<ContextType>({
  path: '',
  isFileModalOpen: false,
  scrollToLine: undefined,
  setIsFileModalOpen: () => {},
  openFileModal: () => {},
  highlightColor: '',
});
