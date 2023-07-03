import React, {
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { FileModalContext } from '../fileModalContext';
import { TabsContext } from '../tabsContext';
import { UITabType } from '../../types/general';

type Props = { tab: UITabType };

export const FileModalContextProvider = ({
  children,
  tab,
}: PropsWithChildren<Props>) => {
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [path, setPath] = useState('');
  const [scrollToLine, setScrollToLine] = useState<string | undefined>();
  const [highlightColor, setHighlightColor] = useState<string | undefined>();
  const { updateTabNavHistory } = useContext(TabsContext);

  const openFileModal = useCallback(
    (p: string, line?: string, color?: string) => {
      setPath(p);
      setScrollToLine(line);
      setHighlightColor(color);
      setIsFileModalOpen(true);
    },
    [],
  );

  useEffect(() => {
    updateTabNavHistory(tab.key, (prev) => {
      if (!prev.length) {
        return prev;
      }
      const pathParams: Record<string, string> = {
        ...prev[prev.length - 1].pathParams,
      };
      if (isFileModalOpen && scrollToLine) {
        pathParams.modalScrollToLine = scrollToLine;
      } else {
        delete pathParams.modalScrollToLine;
      }
      if (isFileModalOpen && highlightColor) {
        pathParams.modalHighlightColor = highlightColor;
      } else {
        delete pathParams.modalHighlightColor;
      }
      if (isFileModalOpen && path) {
        pathParams.modalPath = path;
      } else {
        delete pathParams.modalPath;
      }
      return [
        ...prev,
        {
          ...prev[prev.length - 1],
          pathParams,
        },
      ];
    });
  }, [isFileModalOpen, path, highlightColor, scrollToLine]);

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
