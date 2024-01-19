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
}: PropsWithChildren<Props>) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const handleClick = useCallback(() => {
    if (!path) {
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
    }
  }, [path, openNewTab, studioId, studioName, repoRef, branch, ranges]);

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
