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
  const [highlightColor, setHighlightColor] = useState<string | undefined>();

  const openFileModal = useCallback(
    (p: string, line?: string, color?: string) => {
      setPath(p);
      setScrollToLine(line);
      setHighlightColor(color);
      setIsFileModalOpen(true);
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      isFileModalOpen,
      setIsFileModalOpen,
      path,
      scrollToLine,
      openFileModal,
      highlightColor,
    }),
    [isFileModalOpen, path, scrollToLine, openFileModal, highlightColor],
  );
  return (
    <FileModalContext.Provider value={contextValue}>
      {children}
    </FileModalContext.Provider>
  );
};
