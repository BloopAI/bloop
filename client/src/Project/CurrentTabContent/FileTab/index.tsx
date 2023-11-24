import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  forceFileToBeIndexed,
  getFileContent,
  getHoverables,
} from '../../../services/api';
import FileIcon from '../../../components/FileIcon';
import Button from '../../../components/Button';
import {
  EyeCutIcon,
  FileWithSparksIcon,
  MoreHorizontalIcon,
  SplitViewIcon,
} from '../../../icons';
import { FileResponse } from '../../../types/api';
import { mapRanges } from '../../../mappers/results';
import { Range } from '../../../types/results';
import CodeFull from '../../../components/Code/CodeFull';
import IpynbRenderer from '../../../components/IpynbRenderer';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import { FileTabType, SyncStatus, TabTypesEnum } from '../../../types/general';
import { FileHighlightsContext } from '../../../context/fileHighlightsContext';
import Dropdown from '../../../components/Dropdown';
import { TabsContext } from '../../../context/tabsContext';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { CommandBarContext } from '../../../context/commandBarContext';
import { openInSplitViewShortcut } from '../../../consts/commandBar';
import BreadcrumbsPathContainer from '../../../components/Breadcrumbs/PathContainer';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { UIContext } from '../../../context/uiContext';
import ActionsDropdown from './ActionsDropdown';

type Props = {
  tabKey: string;
  repoRef: string;
  path: string;
  scrollToLine?: string;
  tokenRange?: string;
  noBorder?: boolean;
  branch?: string | null;
  side: 'left' | 'right';
  handleMoveToAnotherSide: () => void;
};

export const explainFileShortcut = ['cmd', 'E'];

const FileTab = ({
  path,
  noBorder,
  repoRef,
  scrollToLine,
  branch,
  side,
  tokenRange,
  handleMoveToAnotherSide,
  tabKey,
}: Props) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<FileResponse | null>(null);
  const [hoverableRanges, setHoverableRanges] = useState<
    Record<number, Range[]> | undefined
  >(undefined);
  const [indexRequested, setIndexRequested] = useState(false);
  const [isFetched, setIsFetched] = useState(false);
  const { setFocusedTabItems } = useContext(CommandBarContext.Handlers);
  const [isPending, startTransition] = useTransition();
  const { openNewTab, updateTabProperty } = useContext(TabsContext.Handlers);
  const { focusedPanel } = useContext(TabsContext.All);
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const { fileHighlights, hoveredLines } = useContext(
    FileHighlightsContext.Values,
  );
  const { indexingStatus } = useContext(RepositoriesContext);

  const highlights = useMemo(() => {
    return fileHighlights[path]?.sort((a, b) =>
      a && b && a?.lines?.[1] - a?.lines?.[0] < b?.lines?.[1] - b?.lines?.[0]
        ? -1
        : 1,
    );
  }, [path, fileHighlights]);

  useEffect(() => {
    setIndexRequested(false);
    setIsFetched(false);
  }, [path, repoRef]);

  const refetchFile = useCallback(async () => {
    try {
      const resp = await getFileContent(repoRef, path, branch);
      if (!resp) {
        setIsFetched(true);
        return;
      }
      startTransition(() => {
        setFile(resp);
        setIsFetched(true);
      });
      // if (item.indexed) {
      const data = await getHoverables(path, repoRef, branch);
      setHoverableRanges(mapRanges(data.ranges));
      // }
    } catch (err) {
      setIsFetched(true);
    }
  }, [repoRef, path, branch]);

  useEffect(() => {
    refetchFile();
  }, [refetchFile]);

  useEffect(() => {
    if (indexingStatus[repoRef]?.status === SyncStatus.Done) {
      setTimeout(refetchFile, 2000);
    }
  }, [indexingStatus[repoRef]?.status]);

  const onIndexRequested = useCallback(async () => {
    if (path) {
      setIndexRequested(true);
      await forceFileToBeIndexed(repoRef, path);
      setTimeout(() => refetchFile(), 1000);
    }
  }, [repoRef, path]);

  const handleClick = useCallback(() => {
    updateTabProperty<FileTabType, 'isTemp'>(tabKey, 'isTemp', false, side);
  }, [updateTabProperty, tabKey, side]);

  const linesNumber = useMemo(() => {
    return file?.contents?.split(/\n(?!$)/g).length || 0;
  }, [file?.contents]);

  const handleExplain = useCallback(() => {
    openNewTab(
      {
        type: TabTypesEnum.CHAT,
        initialQuery: {
          path,
          repoRef,
          branch,
          lines: [0, linesNumber - 1],
        },
      },
      side === 'left' ? 'right' : 'left',
    );
  }, [path, repoRef, branch, linesNumber, side, openNewTab]);
  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, explainFileShortcut)) {
        handleExplain();
      } else if (checkEventKeys(e, openInSplitViewShortcut)) {
        handleMoveToAnotherSide();
      }
    },
    [handleExplain, handleMoveToAnotherSide],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    !file?.contents || focusedPanel !== side || isLeftSidebarFocused,
  );

  useEffect(() => {
    if (focusedPanel === side && file?.contents) {
      setFocusedTabItems([
        {
          label: t('Explain file'),
          Icon: FileWithSparksIcon,
          id: 'explain_file',
          key: 'explain_file',
          onClick: handleExplain,
          closeOnClick: true,
          shortcut: explainFileShortcut,
          footerHint: '',
          footerBtns: [{ label: t('Explain'), shortcut: ['entr'] }],
        },
        {
          label: t('Open in split view'),
          Icon: SplitViewIcon,
          id: 'split_view',
          key: 'split_view',
          onClick: handleMoveToAnotherSide,
          closeOnClick: true,
          shortcut: openInSplitViewShortcut,
          footerHint: '',
          footerBtns: [{ label: t('Move'), shortcut: ['entr'] }],
        },
      ]);
    }
  }, [
    focusedPanel,
    side,
    file?.contents,
    handleExplain,
    handleMoveToAnotherSide,
  ]);

  const dropdownComponentProps = useMemo(() => {
    return {
      handleExplain,
      handleMoveToAnotherSide,
    };
  }, [handleExplain, handleMoveToAnotherSide]);

  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      }`}
      onClick={handleClick}
    >
      <div className="w-full h-10 px-4 flex justify-between items-center flex-shrink-0 border-b border-bg-border bg-bg-sub">
        <div className="flex items-center gap-3 body-s text-label-title ellipsis">
          <FileIcon filename={path} noMargin />
          <BreadcrumbsPathContainer
            path={path}
            repoRef={repoRef}
            nonInteractive
          />
        </div>
        {focusedPanel === side && (
          <Dropdown
            DropdownComponent={ActionsDropdown}
            dropdownComponentProps={dropdownComponentProps}
            dropdownPlacement="bottom-end"
            appendTo={document.body}
          >
            <Button
              variant="tertiary"
              size="mini"
              onlyIcon
              title={t('More actions')}
            >
              <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
            </Button>
          </Dropdown>
        )}
      </div>
      <div className="flex-1 h-full max-w-full pl-4 py-4 overflow-auto relative">
        {file?.lang === 'jupyter notebook' ? (
          <IpynbRenderer data={file.contents} />
        ) : file ? (
          <AutoSizer>
            {({ width, height }) => (
              <CodeFull
                isSearchDisabled={focusedPanel !== side}
                code={file.contents}
                language={file.lang}
                repoRef={repoRef}
                relativePath={path}
                hoverableRanges={hoverableRanges}
                scrollToLine={scrollToLine}
                branch={branch}
                tokenRange={tokenRange}
                highlights={highlights}
                hoveredLines={hoveredLines}
                side={side}
                width={width}
                height={height}
              />
            )}
          </AutoSizer>
        ) : isFetched && !file ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-6">
            <div className="w-15 h-15 flex items-center justify-center rounded-xl border border-bg-divider">
              <EyeCutIcon sizeClassName="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-2 items-center text-center max-w-[18.75rem]">
              <p className="body-base-b text-label-title">
                <Trans>File not indexed</Trans>
              </p>
              <p className="body-s text-label-base !leading-5">
                <Trans>
                  This might be because the file is too big or it has one of
                  bloop&apos;s excluded file types.
                </Trans>
              </p>
            </div>
            {!indexRequested ? (
              <Button size="large" variant="primary" onClick={onIndexRequested}>
                <Trans>Index</Trans>
              </Button>
            ) : (
              <div className="text-bg-main mt-6">
                <SpinLoaderContainer sizeClassName="w-8 h-8" />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default memo(FileTab);
