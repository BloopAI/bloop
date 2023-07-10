import React, {
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { FileModalContext } from '../fileModalContext';
import { TabsContext } from '../tabsContext';
import { NavigationItem, UITabType } from '../../types/general';

type Props = { tab: UITabType };

const getTabNavHistory = (
  prev: NavigationItem[],
  isOpen: boolean,
  scrollToLine?: string,
  highlightColor?: string,
  path?: string,
) => {
  if (!prev.length) {
    return prev;
  }
  const pathParams: Record<string, string> = {
    ...prev[prev.length - 1].pathParams,
  };
  if (isOpen && scrollToLine) {
    pathParams.modalScrollToLine = scrollToLine;
  } else {
    delete pathParams.modalScrollToLine;
  }
  if (isOpen && highlightColor) {
    pathParams.modalHighlightColor = highlightColor;
  } else {
    delete pathParams.modalHighlightColor;
  }
  if (isOpen && path) {
    pathParams.modalPath = path;
  } else {
    delete pathParams.modalPath;
  }
  if (
    JSON.stringify(pathParams) ===
    JSON.stringify(prev[prev.length - 1].pathParams)
  ) {
    return prev;
  }
  return [
    ...prev,
    {
      ...prev[prev.length - 1],
      pathParams,
    },
  ];
};

export const FileModalContextProvider = ({
  children,
  tab,
}: PropsWithChildren<Props>) => {
  const [isFileModalOpen, setFileModalOpen] = useState(false);
  const [path, setPath] = useState('');
  const [scrollToLine, setScrollToLine] = useState<string | undefined>();
  const [highlightColor, setHighlightColor] = useState<string | undefined>();
  const { updateTabNavHistory } = useContext(TabsContext);

  const openFileModal = useCallback(
    (p: string, line?: string, color?: string) => {
      setPath(p);
      setScrollToLine(line);
      setHighlightColor(color);
      setFileModalOpen(true);
      updateTabNavHistory(tab.key, (prev) =>
        getTabNavHistory(prev, true, line, color, p),
      );
    },
    [],
  );

  const closeFileModalOpen = useCallback(() => {
    setFileModalOpen(false);
    updateTabNavHistory(tab.key, (prev) =>
      getTabNavHistory(prev, false, scrollToLine, highlightColor, path),
    );
  }, [path, highlightColor, scrollToLine]);

  const contextValue = useMemo(
    () => ({
      isFileModalOpen,
      closeFileModalOpen,
      path,
      scrollToLine,
      openFileModal,
      highlightColor,
    }),
    [
      isFileModalOpen,
      path,
      scrollToLine,
      openFileModal,
      highlightColor,
      closeFileModalOpen,
    ],
  );
  return (
    <FileModalContext.Provider value={contextValue}>
      {children}
    </FileModalContext.Provider>
  );
};
