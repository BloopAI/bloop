import React, { memo, PropsWithChildren, useCallback, useContext } from 'react';
import { TabsContext } from '../../../../context/tabsContext';
import { TabTypesEnum } from '../../../../types/general';
import { Range } from '../../../../types/results';
import { HistoryConversationTurn } from '../../../../types/api';
import { useArrowNavigationItemProps } from '../../../../hooks/useArrowNavigationItemProps';

type Props = {
  index: string;
  studioId: string;
  studioName: string;
  path?: string;
  repoRef?: string;
  branch?: string | null;
  ranges?: Range[];
  docId?: string;
  relativeUrl?: string;
  docTitle?: string;
  docFavicon?: string;
  sections?: string[];
  morePadding?: boolean;
  snapshot?: HistoryConversationTurn | null;
  isCurrentPath?: boolean;
};

const StudioSubItem = ({
  index,
  children,
  studioId,
  studioName,
  path,
  repoRef,
  branch,
  ranges,
  relativeUrl,
  docId,
  docTitle,
  docFavicon,
  sections,
  morePadding,
  snapshot,
  isCurrentPath,
}: PropsWithChildren<Props>) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const onClick = useCallback(() => {
    if (path && repoRef) {
      openNewTab({
        type: TabTypesEnum.FILE,
        path,
        repoRef,
        branch,
        studioId,
        isFileInContext: true,
        initialRanges: ranges?.map((r) => [r.start, r.end]),
      });
    } else if (docId) {
      openNewTab({
        type: TabTypesEnum.DOC,
        studioId,
        title: docTitle,
        relativeUrl: relativeUrl || '',
        docId,
        favicon: docFavicon,
        isDocInContext: true,
        initialSections: sections,
      });
    } else if (snapshot !== undefined) {
      openNewTab({
        type: TabTypesEnum.STUDIO,
        studioId,
        title: studioName,
        snapshot: snapshot || undefined,
      });
    } else if (!path && !docId) {
      openNewTab({ type: TabTypesEnum.STUDIO, studioId, title: studioName });
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
    snapshot,
  ]);

  const { isFocused, isLeftSidebarFocused, props } =
    useArrowNavigationItemProps<HTMLAnchorElement>(index, onClick);

  return (
    <a
      href="#"
      className={`w-full h-7 flex items-center gap-3 ${
        morePadding ? 'pl-[4.25rem]' : 'pl-10.5'
      } pr-4 ${
        isCurrentPath
          ? isLeftSidebarFocused
            ? 'bg-bg-shade-hover text-label-title'
            : 'bg-bg-shade text-label-title'
          : isFocused
          ? 'bg-bg-sub-hover text-label-title'
          : 'text-label-base'
      }`}
      {...props}
    >
      {children}
    </a>
  );
};

export default memo(StudioSubItem);
