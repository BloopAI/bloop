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
import {
  forceFileToBeIndexed,
  getCodeStudio,
  getFileContent,
  getFileTokenCount,
  getHoverables,
  patchCodeStudio,
} from '../../../services/api';
import FileIcon from '../../../components/FileIcon';
import Button from '../../../components/Button';
import {
  EyeCutIcon,
  FileWithSparksIcon,
  MoreHorizontalIcon,
  SplitViewIcon,
  StudioCloseSignIcon,
  StudioPlusSignIcon,
} from '../../../icons';
import { CodeStudioType, FileResponse } from '../../../types/api';
import { mapRanges } from '../../../mappers/results';
import { Range } from '../../../types/results';
import IpynbRenderer from '../../../components/IpynbRenderer';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import {
  CommandBarStepEnum,
  FileTabType,
  SyncStatus,
  TabTypesEnum,
} from '../../../types/general';
import { FileHighlightsContext } from '../../../context/fileHighlightsContext';
import Dropdown from '../../../components/Dropdown';
import { TabsContext } from '../../../context/tabsContext';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { CommandBarContext } from '../../../context/commandBarContext';
import BreadcrumbsPathContainer from '../../../components/Breadcrumbs/PathContainer';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { UIContext } from '../../../context/uiContext';
import {
  addToStudioShortcut,
  escapeShortcut,
  explainFileShortcut,
  openInSplitViewShortcut,
  removeFromStudioShortcut,
  saveShortcut,
  selectLinesShortcut,
} from '../../../consts/shortcuts';
import { ProjectContext } from '../../../context/projectContext';
import Badge from '../../../components/Badge';
import { humanNumber } from '../../../utils';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import CodeFullSelectable from '../../../components/Code/CodeFullSelectable';
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
  studioId?: string;
  initialRanges?: [number, number][];
  isFileInContext?: boolean;
  isTemp?: boolean;
  handleMoveToAnotherSide: () => void;
};

const FileTab = ({
  path,
  noBorder,
  repoRef,
  scrollToLine,
  branch = null,
  side,
  tokenRange,
  handleMoveToAnotherSide,
  tabKey,
  studioId,
  initialRanges,
  isFileInContext,
  isTemp,
}: Props) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<FileResponse | null>(null);
  const [hoverableRanges, setHoverableRanges] = useState<
    Record<number, Range[]> | undefined
  >(undefined);
  const [indexRequested, setIndexRequested] = useState(false);
  const [isFetched, setIsFetched] = useState(false);
  const [studio, setStudio] = useState<CodeStudioType | null>(null);
  const [selectedLines, setSelectedLines] = useState<[number, number][]>(
    initialRanges || [],
  );
  const [isEditingRanges, setIsEditingRanges] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const { setFocusedTabItems, setIsVisible, setChosenStep } = useContext(
    CommandBarContext.Handlers,
  );
  const { isVisible: isCommandBarVisible } = useContext(
    CommandBarContext.General,
  );
  const [isPending, startTransition] = useTransition();
  const { openNewTab, updateTabProperty } = useContext(TabsContext.Handlers);
  const { focusedPanel } = useContext(TabsContext.FocusedPanel);
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const { setOnBoardingState } = useContext(UIContext.Onboarding);
  const { project, refreshCurrentProjectStudios } = useContext(
    ProjectContext.Current,
  );
  const { fileHighlights, hoveredLines } = useContext(
    FileHighlightsContext.Values,
  );
  const { indexingStatus } = useContext(RepositoriesContext);

  const refreshStudio = useCallback(() => {
    if (studioId && project?.id) {
      getCodeStudio(project.id, studioId).then(setStudio);
    } else {
      setStudio(null);
    }
  }, [studioId, project?.id]);

  useEffect(() => {
    refreshStudio();
  }, [refreshStudio]);

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
      setSelectedLines(initialRanges || []);
      const resp = await getFileContent(repoRef, path, branch);
      if (!resp) {
        setIsFetched(true);
        return;
      }
      startTransition(() => {
        setFile(resp);
        setIsFetched(true);
      });
      if (initialRanges) {
        setTimeout(
          () => {
            const line = findElementInCurrentTab(
              `[data-active="true"] [data-line-number="${
                initialRanges?.[0] ? initialRanges[0][0] : 0
              }"]`,
            );
            line?.scrollIntoView({
              behavior: 'auto',
              block:
                !!initialRanges?.[0] &&
                initialRanges[0][0] > 1 &&
                initialRanges[0][1] - initialRanges[0][0] > 5
                  ? 'start'
                  : 'center',
            });
          },
          !initialRanges?.[0]
            ? 100
            : initialRanges[0][0] > 1000
            ? 1000
            : initialRanges[0][0] > 500
            ? 800
            : 500,
        );
      }
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
    if (project?.id) {
      const mappedLines: [number, number][] = selectedLines.map((r) => [
        r[0],
        r[1] + 1,
      ]);
      getFileTokenCount(
        project.id,
        path,
        repoRef,
        branch || undefined,
        mappedLines,
      ).then(setTokenCount);
    }
  }, [path, repoRef, branch, selectedLines]);

  const handleEditRanges = useCallback(() => {
    setIsEditingRanges(true);
  }, []);

  useEffect(() => {
    if (studioId && !isFileInContext) {
      handleEditRanges();
    }
  }, [studioId, isFileInContext, handleEditRanges]);

  const handleCancelStudio = useCallback(() => {
    setIsEditingRanges(false);
    if (isFileInContext) {
      setSelectedLines(initialRanges || []);
    } else {
      setSelectedLines([]);
      updateTabProperty<FileTabType, 'studioId'>(
        tabKey,
        'studioId',
        undefined,
        side,
      );
    }
  }, [tabKey, side, isFileInContext, initialRanges]);

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
    if (isTemp) {
      updateTabProperty<FileTabType, 'isTemp'>(tabKey, 'isTemp', false, side);
    }
  }, [updateTabProperty, tabKey, side, isTemp]);

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
    setOnBoardingState((prev) =>
      prev.isFileExplained ? prev : { ...prev, isFileExplained: true },
    );
  }, [path, repoRef, branch, linesNumber, side, openNewTab]);

  const handleAddToStudio = useCallback(() => {
    setChosenStep({
      id: CommandBarStepEnum.ADD_TO_STUDIO,
      data: { path, repoRef, branch },
    });
    setIsVisible(true);
  }, [path, repoRef, branch]);

  const handleRemoveFromStudio = useCallback(async () => {
    if (project?.id && studioId && studio) {
      const patchedFile = studio?.context.find(
        (f) => f.path === path && f.repo === repoRef && f.branch === branch,
      );
      if (patchedFile) {
        await patchCodeStudio(project.id, studioId, {
          context: studio?.context.filter(
            (f) => f.path !== path || f.repo !== repoRef || f.branch !== branch,
          ),
        });
        refreshCurrentProjectStudios();
        refreshStudio();
        setIsEditingRanges(false);
        updateTabProperty<FileTabType, 'isFileInContext'>(
          tabKey,
          'isFileInContext',
          false,
          side,
        );
        updateTabProperty<FileTabType, 'initialRanges'>(
          tabKey,
          'initialRanges',
          undefined,
          side,
        );
        updateTabProperty<FileTabType, 'studioId'>(
          tabKey,
          'studioId',
          undefined,
          side,
        );
        setStudio(null);
        setSelectedLines([]);
      }
    }
  }, [path, repoRef, branch, project?.id, studioId, studio]);

  const handleSubmitToStudio = useCallback(async () => {
    if (project?.id && studioId && studio) {
      const patchedFile = studio?.context.find(
        (f) => f.path === path && f.repo === repoRef && f.branch === branch,
      );
      const mappedRanges = selectedLines.map((r) => ({
        start: r[0],
        end: r[1] + 1,
      }));
      if (!patchedFile) {
        await patchCodeStudio(project.id, studioId, {
          context: [
            ...(studio?.context || []),
            {
              path,
              branch: branch || null,
              repo: repoRef,
              hidden: false,
              ranges: mappedRanges || [],
            },
          ],
        });
      } else {
        patchedFile.ranges = mappedRanges;
        const newContext = studio?.context
          .filter(
            (f) => f.path !== path || f.repo !== repoRef || f.branch !== branch,
          )
          .concat(patchedFile);
        await patchCodeStudio(project.id, studioId, {
          context: newContext,
        });
      }
      refreshCurrentProjectStudios();
      refreshStudio();
      setIsEditingRanges(false);
      updateTabProperty<FileTabType, 'isFileInContext'>(
        tabKey,
        'isFileInContext',
        true,
        side,
      );
      updateTabProperty<FileTabType, 'initialRanges'>(
        tabKey,
        'initialRanges',
        selectedLines,
        side,
      );
    }
  }, [project?.id, studio, path, repoRef, branch, selectedLines, studioId]);

  const hasChanges = useMemo(() => {
    return (
      (studioId && !isFileInContext) ||
      JSON.stringify(initialRanges) !== JSON.stringify(selectedLines)
    );
  }, [studioId, isFileInContext, initialRanges, selectedLines]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, explainFileShortcut)) {
        handleExplain();
      } else if (checkEventKeys(e, openInSplitViewShortcut)) {
        handleMoveToAnotherSide();
      } else if (checkEventKeys(e, addToStudioShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        handleAddToStudio();
      } else if (checkEventKeys(e, removeFromStudioShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        handleRemoveFromStudio();
      } else if (checkEventKeys(e, escapeShortcut) && studioId) {
        e.preventDefault();
        e.stopPropagation();
        handleCancelStudio();
      } else if (checkEventKeys(e, saveShortcut) && studioId) {
        e.preventDefault();
        e.stopPropagation();
        handleSubmitToStudio();
      } else if (
        checkEventKeys(e, selectLinesShortcut) &&
        studioId &&
        !isEditingRanges
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleEditRanges();
      }
    },
    [
      handleExplain,
      handleMoveToAnotherSide,
      handleAddToStudio,
      handleCancelStudio,
      studioId,
      handleSubmitToStudio,
      handleEditRanges,
    ],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    !file?.contents ||
      focusedPanel !== side ||
      isLeftSidebarFocused ||
      isCommandBarVisible,
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
        ...(studioId && isFileInContext
          ? [
              {
                label: t('Remove from studio'),
                Icon: StudioCloseSignIcon,
                id: 'file_from_studio',
                key: 'file_from_studio',
                onClick: handleRemoveFromStudio,
                shortcut: removeFromStudioShortcut,
                footerHint: t('Remove file from code studio context'),
                footerBtns: [{ label: t('Remove'), shortcut: ['entr'] }],
              },
            ]
          : [
              {
                label: t('Add to studio'),
                Icon: StudioPlusSignIcon,
                id: 'file_to_studio',
                key: 'file_to_studio',
                onClick: studioId ? handleSubmitToStudio : handleAddToStudio,
                shortcut: studioId ? saveShortcut : addToStudioShortcut,
                closeOnClick: !!studio,
                footerHint: t('Add file to code studio context'),
                footerBtns: [{ label: t('Add'), shortcut: ['entr'] }],
              },
            ]),
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
    handleAddToStudio,
  ]);

  const dropdownComponentProps = useMemo(() => {
    return {
      handleExplain,
      handleMoveToAnotherSide,
      handleAddToStudio,
      handleRemoveFromStudio,
      isFileInContext,
    };
  }, [
    handleExplain,
    handleMoveToAnotherSide,
    handleAddToStudio,
    handleRemoveFromStudio,
    isFileInContext,
  ]);

  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      } inline-container`}
      onClick={handleClick}
    >
      <div
        className={`w-full px-4 flex gap-1 items-center flex-shrink-0 border-b border-bg-border bg-bg-sub ${
          !!studio && studioId ? 'wrap-in-sm-container' : 'h-10'
        }`}
      >
        <div className="flex items-center gap-3 body-s text-label-title ellipsis flex-shrink">
          <FileIcon filename={path} noMargin />
          <BreadcrumbsPathContainer
            path={path}
            repoRef={repoRef}
            nonInteractive
          />
        </div>
        {!!studio && studioId && (
          <div className="flex items-center gap-3 body-s flex-shrink-0">
            <div className="w-px h-4 bg-bg-border flex-shrink-0 ml-3" />
            <Badge
              text={
                selectedLines.length
                  ? selectedLines.length === 1
                    ? t('Lines # - #', {
                        start: selectedLines[0][0] + 1,
                        end: selectedLines[0][1] ? selectedLines[0][1] + 1 : '',
                      })
                    : t('# ranges', { count: selectedLines.length })
                  : t('Whole file')
              }
              type="blue-subtle"
              size="small"
            />
            <p
              className={`select-none ${
                tokenCount < 18000 && tokenCount > 1500
                  ? 'text-yellow'
                  : tokenCount <= 1500
                  ? 'text-green'
                  : 'text-red'
              } code-mini flex-shrink-0`}
            >
              {humanNumber(tokenCount)}{' '}
              <Trans count={tokenCount}># tokens</Trans>
            </p>
          </div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {focusedPanel === side &&
            (studioId && (hasChanges || isEditingRanges) ? (
              <div className="flex items-center gap-3">
                {!isEditingRanges && (
                  <>
                    <Button
                      variant="secondary"
                      size="mini"
                      onClick={handleEditRanges}
                      shortcut={selectLinesShortcut}
                      title={t('Create line ranges')}
                    >
                      <Trans>Create ranges</Trans>
                    </Button>
                    <div className="w-px h-4 bg-bg-border flex-shrink-0" />
                  </>
                )}
                <Button
                  variant="tertiary"
                  size="mini"
                  onClick={handleCancelStudio}
                  title={t('Cancel')}
                  shortcut={escapeShortcut}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant={isFileInContext ? 'secondary' : 'studio'}
                  size="mini"
                  onClick={handleSubmitToStudio}
                  title={t(isFileInContext ? 'Save changes' : 'Add to studio')}
                  shortcut={saveShortcut}
                >
                  <Trans>{isFileInContext ? 'Save changes' : 'Add'}</Trans>
                </Button>
              </div>
            ) : (
              studioId && (
                <Button
                  variant="secondary"
                  size="mini"
                  onClick={handleEditRanges}
                  shortcut={selectLinesShortcut}
                  title={t('Edit selected lines')}
                  tooltipClassName="flex-shrink-0"
                >
                  <Trans>Edit ranges</Trans>
                </Button>
              )
            ))}
          {!isEditingRanges && (
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
      </div>
      <div className="relative flex-1 h-full max-w-full">
        <div
          className="flex-1 h-full max-w-full pl-4 py-4 overflow-auto"
          data-active={(focusedPanel === side).toString()}
          data-path={path}
        >
          {file?.lang === 'jupyter notebook' ? (
            <IpynbRenderer data={file.contents} />
          ) : file ? (
            <CodeFullSelectable
              code={file.contents}
              language={file.lang}
              isSearchDisabled={focusedPanel !== side}
              currentSelection={selectedLines}
              setCurrentSelection={setSelectedLines}
              relativePath={path}
              repoRef={repoRef}
              hoverableRanges={hoverableRanges}
              scrollToLine={scrollToLine}
              branch={branch}
              tokenRange={tokenRange}
              highlights={highlights}
              hoveredLines={hoveredLines}
              side={side}
              isEditingRanges={isEditingRanges}
            />
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
                <Button
                  size="large"
                  variant="primary"
                  onClick={onIndexRequested}
                >
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
    </div>
  );
};

export default memo(FileTab);
