import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import {
  CodeStudioIcon,
  InfoBadgeIcon,
  MoreHorizontalIcon,
  SplitViewIcon,
} from '../../../icons';
import Dropdown from '../../../components/Dropdown';
import { checkEventKeys } from '../../../utils/keyboardUtils';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { TabsContext } from '../../../context/tabsContext';
import {
  ChatTabType,
  SettingSections,
  StudioTabType,
} from '../../../types/general';
import { ProjectContext } from '../../../context/projectContext';
import { CommandBarContext } from '../../../context/commandBarContext';
import { openInSplitViewShortcut } from '../../../consts/commandBar';
import { UIContext } from '../../../context/uiContext';
import TokenUsage from '../../../components/TokenUsage';
import { StudioContext, StudiosContext } from '../../../context/studiosContext';
import { TOKEN_LIMIT } from '../../../consts/codeStudio';
import { PersonalQuotaContext } from '../../../context/personalQuotaContext';
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
  title,
  studioId,
  tabKey,
  handleMoveToAnotherSide,
}: Props) => {
  const { t } = useTranslation();
  const { focusedPanel } = useContext(TabsContext.All);
  const { studios } = useContext(StudiosContext);
  const { closeTab } = useContext(TabsContext.Handlers);
  const { requestsLeft, isSubscribed, hasCheckedQuota } = useContext(
    PersonalQuotaContext.Values,
  );
  const { setSettingsSection, setSettingsOpen } = useContext(
    UIContext.Settings,
  );
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const { setFocusedTabItems } = useContext(CommandBarContext.Handlers);
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

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['cmd', ']'])) {
        handleMoveToAnotherSide();
      }
    },
    [handleMoveToAnotherSide],
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
      ]);
    }
  }, [focusedPanel, side, handleMoveToAnotherSide]);

  const onUpgradeClick = useCallback(() => {
    setSettingsSection(SettingSections.SUBSCRIPTION);
    setSettingsOpen(true);
  }, []);

  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      }`}
    >
      <div className="w-full h-10 px-4 flex justify-between gap-2 items-center flex-shrink-0 border-b border-bg-border bg-bg-sub">
        <div className="flex items-center gap-3 body-s text-label-title ellipsis">
          <CodeStudioIcon
            sizeClassName="w-4 h-4"
            className="text-brand-studio"
          />
          <span className="ellipsis">
            {title || t('New studio conversation')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TokenUsage percent={(studioData?.tokenCount / TOKEN_LIMIT) * 100} />
          <span className="body-mini-b text-label-base">
            <Trans
              values={{ count: studioData?.tokenCount, total: TOKEN_LIMIT }}
            >
              <span
                className={
                  studioData?.tokenCount > TOKEN_LIMIT ? 'text-bg-danger' : ''
                }
              >
                #
              </span>{' '}
              of # tokens
            </Trans>
          </span>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          {hasCheckedQuota && !isSubscribed && (
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1 body-mini text-label-muted">
                <span>
                  {requestsLeft} <Trans count={requestsLeft}>uses left</Trans>
                </span>
                <InfoBadgeIcon sizeClassName="w-3.5 h-3.5" />
              </div>
              <Button size="mini" onClick={onUpgradeClick}>
                <Trans>Upgrade</Trans>
              </Button>
            </div>
          )}
          {focusedPanel === side && (
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
            requestsLeft={requestsLeft}
            isActiveTab={focusedPanel === side && !isLeftSidebarFocused}
          />
        )}
      </div>
    </div>
  );
};

export default memo(StudioTab);
