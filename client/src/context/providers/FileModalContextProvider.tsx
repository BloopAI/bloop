import React, {
  PropsWithChildren,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { FileModalContext } from '../fileModalContext';

type Props = {};

export const FileModalContextProvider = ({
  children,
}: PropsWithChildren<Props>) => {
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [path, setPath] = useState('');
  const [scrollToLine, setScrollToLine] = useState<string | undefined>();

  const openFileModal = useCallback((p: string, line?: string) => {
    setPath(p);
    setScrollToLine(line);
    setIsFileModalOpen(true);
  }, []);

  const contextValue = useMemo(
    () => ({
      isFileModalOpen,
      setIsFileModalOpen,
      path,
      scrollToLine,
      openFileModal,
    }),
    [isFileModalOpen, path, scrollToLine, openFileModal],
  );
  return (
    <FileModalContext.Provider value={contextValue}>
      {children}
    </FileModalContext.Provider>
  );
};
