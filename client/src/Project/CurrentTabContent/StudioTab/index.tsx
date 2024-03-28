import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import Button from '../../../components/Button';
import {
  DateTimeCalendarIcon,
  FileWithSparksIcon,
  MoreHorizontalIcon,
  PromptIcon,
  SplitViewIcon,
} from '../../../icons';
import Dropdown from '../../../components/Dropdown';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { TabsContext } from '../../../context/tabsContext';
import { CommandBarStepEnum, StudioTabType } from '../../../types/general';
import { ProjectContext } from '../../../context/projectContext';
import { CommandBarContext } from '../../../context/commandBarContext';
import { UIContext } from '../../../context/uiContext';
import TokenUsage from '../../../components/TokenUsage';
import { StudioContext, StudiosContext } from '../../../context/studiosContext';
import { TOKEN_LIMIT } from '../../../consts/codeStudio';
import {
  addToStudioShortcut,
  escapeShortcut,
  openInSplitViewShortcut,
  saveShortcut,
} from '../../../consts/shortcuts';
import { getDateFnsLocale } from '../../../utils';
import { LocaleContext } from '../../../context/localeContext';
import { patchCodeStudio } from '../../../services/api';
import ActionsDropdown from './ActionsDropdown';
import Conversation from './Conversation';

type Props = StudioTabType & {
  noBorder?: boolean;
  side: 'left' | 'right';
  tabKey: string;
  handleMoveToAnotherSide: () => void;
};

const StudioTab = ({
  noBorder,
  side,
  studioId,
  tabKey,
  handleMoveToAnotherSide,
  snapshot,
}: Props) => {
  const { t } = useTranslation();
  const { locale } = useContext(LocaleContext);
  const { focusedPanel } = useContext(TabsContext.FocusedPanel);
  const { studios } = useContext(StudiosContext);
  const { closeTab, updateTabProperty } = useContext(TabsContext.Handlers);
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const { setFocusedTabItems, setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const { project, refreshCurrentProjectStudios } = useContext(
    ProjectContext.Current,
  );

  const studioData: StudioContext | undefined = useMemo(
    () => studios[tabKey],
    [studios, tabKey],
  );

  const dropdownComponentProps = useMemo(() => {
    return {
      handleMoveToAnotherSide,
      studioId,
      projectId: project?.id,
      tabKey,
      closeTab,
      refreshCurrentProjectStudios,
      side,
      clearConversation: studioData?.clearConversation,
    };
  }, [
    handleMoveToAnotherSide,
    studioId,
    closeTab,
    project?.id,
    tabKey,
    refreshCurrentProjectStudios,
    studioData?.clearConversation,
    side,
  ]);

  const handleAddFiles = useCallback(() => {
    setChosenStep({
      id: CommandBarStepEnum.SEARCH_FILES,
      data: { studioId },
    });
    setIsVisible(true);
  }, [studioId]);

  const cancelSnapshot = useCallback(() => {
    updateTabProperty<StudioTabType, 'snapshot'>(
      tabKey,
      'snapshot',
      undefined,
      side,
    );
  }, [updateTabProperty, side, tabKey]);

  const saveSnapshot = useCallback(async () => {
    if (snapshot && project?.id) {
      await patchCodeStudio(project.id, tabKey, {
        context: snapshot.context,
        messages: snapshot.messages,
      });
      studioData?.refetchCodeStudio?.();
      refreshCurrentProjectStudios();
      cancelSnapshot();
    }
  }, [tabKey, snapshot, project?.id, studioData, cancelSnapshot]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, openInSplitViewShortcut)) {
        handleMoveToAnotherSide();
      } else if (checkEventKeys(e, addToStudioShortcut)) {
        handleAddFiles();
      } else if (checkEventKeys(e, escapeShortcut) && snapshot) {
        e.preventDefault();
        e.stopPropagation();
        cancelSnapshot();
      } else if (checkEventKeys(e, saveShortcut) && snapshot) {
        e.preventDefault();
        e.stopPropagation();
        saveSnapshot();
      }
    },
    [handleMoveToAnotherSide, handleAddFiles, snapshot, cancelSnapshot],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    focusedPanel !== side || isLeftSidebarFocused,
  );

  useEffect(() => {
    if (focusedPanel === side) {
      setFocusedTabItems([
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
        {
          label: t('Add files to studio'),
          Icon: FileWithSparksIcon,
          id: 'add_file_to_studio',
          key: 'add_file_to_studio',
          onClick: handleAddFiles,
          shortcut: addToStudioShortcut,
          footerHint: '',
          footerBtns: [{ label: t('Search files'), shortcut: ['entr'] }],
        },
      ]);
    }
  }, [focusedPanel, side, handleMoveToAnotherSide]);

  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      }`}
    >
      <div className="w-full h-10 px-4 flex justify-between gap-2 items-center flex-shrink-0 border-b border-bg-border bg-bg-sub">
        <div className="flex items-center gap-3 body-s text-label-title ellipsis">
          {snapshot ? (
            <DateTimeCalendarIcon sizeClassName="w-4 h-4" />
          ) : (
            <PromptIcon sizeClassName="w-4 h-4" />
          )}
          <span className="ellipsis">
            {snapshot ? (
              format(
                new Date(snapshot.modified_at + '.000Z'),
                'd MMM yyyy · hh:mm a',
                getDateFnsLocale(locale),
              )
            ) : (
              <Trans>Prompts</Trans>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TokenUsage
            percent={
              (((snapshot?.token_counts || studioData?.tokenCount)?.total ||
                0) /
                TOKEN_LIMIT) *
              100
            }
          />
          <span className="body-mini-b text-label-base">
            <Trans
              values={{
                count:
                  (snapshot?.token_counts || studioData?.tokenCount)?.total ||
                  0,
                total: TOKEN_LIMIT,
              }}
            >
              <span
                className={
                  ((snapshot?.token_counts || studioData?.tokenCount)?.total ||
                    0) > TOKEN_LIMIT
                    ? 'text-bg-danger'
                    : ''
                }
              >
                #
              </span>{' '}
              of # tokens
            </Trans>
          </span>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0 select-none">
          {focusedPanel === side && snapshot ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="tertiary"
                size="mini"
                title={t('Go to current state')}
                shortcut={escapeShortcut}
                tooltipPlacement="bottom"
                onClick={cancelSnapshot}
              >
                <Trans>Back to current</Trans>
              </Button>
              <Button
                variant="studio"
                size="mini"
                title={t('Continue from this state')}
                tooltipPlacement="bottom"
                shortcut={saveShortcut}
                onClick={saveSnapshot}
              >
                <Trans>Restore session</Trans>
              </Button>
            </div>
          ) : (
            <Dropdown
              DropdownComponent={ActionsDropdown}
              dropdownComponentProps={dropdownComponentProps}
              appendTo={document.body}
              dropdownPlacement="bottom-end"
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
      <div className="flex-1 flex flex-col max-w-full px-4 overflow-auto">
        {!!studioData && (
          <Conversation
            side={side}
            tabKey={tabKey}
            studioData={studioData}
            studioId={studioId}
            isActiveTab={focusedPanel === side && !isLeftSidebarFocused}
            snapshot={snapshot}
          />
        )}
      </div>
    </div>
  );
};

export default memo(StudioTab);
