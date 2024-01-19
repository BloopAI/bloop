import React, { memo, PropsWithChildren, useCallback, useContext } from 'react';
import { TabsContext } from '../../../../context/tabsContext';
import { TabTypesEnum } from '../../../../types/general';
import { useEnterKey } from '../../../../hooks/useEnterKey';
import { Range } from '../../../../types/results';

type Props = {
  index: string;
  focusedIndex: string;
  studioId: string;
  studioName: string;
  path?: string;
  repoRef?: string;
  branch?: string | null;
  isLeftSidebarFocused: boolean;
  isCommandBarVisible: boolean;
  ranges?: Range[];
  docId?: string;
  relativeUrl?: string;
  docTitle?: string;
  docFavicon?: string;
  sections?: string[];
};

const StudioSubItem = ({
  index,
  focusedIndex,
  children,
  studioId,
  studioName,
  path,
  repoRef,
  branch,
  isLeftSidebarFocused,
  isCommandBarVisible,
  ranges,
  relativeUrl,
  docId,
  docTitle,
  docFavicon,
  sections,
}: PropsWithChildren<Props>) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const handleClick = useCallback(() => {
    if (!path && !docId) {
      openNewTab({ type: TabTypesEnum.STUDIO, studioId, title: studioName });
    } else if (path && repoRef) {
      openNewTab({
        type: TabTypesEnum.FILE,
        path,
        repoRef,
        branch,
        studioId,
        isFileInContext: true,
        initialRanges: ranges?.map((r) => [r.start, r.end]),
      });
    } else if (docId && relativeUrl) {
      openNewTab({
        type: TabTypesEnum.DOC,
        studioId,
        title: docTitle,
        relativeUrl,
        docId,
        favicon: docFavicon,
        isDocInContext: true,
        initialSections: sections,
      });
    }
  }, [
    path,
    openNewTab,
    studioId,
    studioName,
    repoRef,
    branch,
    ranges,
    sections,
    docId,
    docTitle,
    docFavicon,
    relativeUrl,
  ]);

  useEnterKey(
    handleClick,
    focusedIndex !== index || !isLeftSidebarFocused || isCommandBarVisible,
  );

  return (
    <a
      href="#"
      className={`w-full h-7 flex items-center gap-3 pl-10.5 pr-4 
        hover:text-label-title hover:bg-bg-base-hover ${
          focusedIndex.startsWith(index)
            ? 'bg-bg-sub-hover text-label-title'
            : 'text-label-base'
        }`}
      onClick={handleClick}
      data-node-index={index}
    >
      {children}
    </a>
  );
};

export default memo(StudioSubItem);
