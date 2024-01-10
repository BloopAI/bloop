import {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ProjectContext } from '../../context/projectContext';
import {
  BugIcon,
  ChatBubblesIcon,
  CloseSignInCircleIcon,
  CogIcon,
  ColorSwitchIcon,
  DocumentsIcon,
  DoorOutIcon,
  MagazineIcon,
  MagnifyToolIcon,
  PlusSignIcon,
  RegexIcon,
  RepositoryIcon,
  WalletIcon,
} from '../../icons';
import { CommandBarContext } from '../../context/commandBarContext';
import Header from '../Header';
import Body from '../Body';
import Footer from '../Footer';
import {
  CommandBarItemGeneralType,
  CommandBarSectionType,
  CommandBarStepEnum,
  TabTypesEnum,
} from '../../types/general';
import { UIContext } from '../../context/uiContext';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';
import {
  getJsonFromStorage,
  RECENT_COMMANDS_KEY,
} from '../../services/storage';
import { bubbleUpRecentItems } from '../../utils/commandBarUtils';
import { TabsContext } from '../../context/tabsContext';

type Props = {};

const InitialCommandBar = ({}: Props) => {
  const { t } = useTranslation();
  const { setIsVisible } = useContext(CommandBarContext.Handlers);
  const { tabItems } = useContext(CommandBarContext.FocusedTab);
  const { openNewTab } = useContext(TabsContext.Handlers);
  const { projects } = useContext(ProjectContext.All);
  const { setCurrentProjectId, project } = useContext(ProjectContext.Current);
  const { theme } = useContext(UIContext.Theme);
  const [inputValue, setInputValue] = useState('');
  const globalShortcuts = useGlobalShortcuts();

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const switchProject = useCallback((id: string) => {
    setCurrentProjectId(id);
    setIsVisible(false);
  }, []);

  const initialSections = useMemo(() => {
    const recentKeys = getJsonFromStorage<string[]>(RECENT_COMMANDS_KEY);
    const contextItems: CommandBarItemGeneralType[] = [
      {
        label: t('Manage repositories'),
        Icon: RepositoryIcon,
        id: CommandBarStepEnum.MANAGE_REPOS,
        key: CommandBarStepEnum.MANAGE_REPOS,
        shortcut: globalShortcuts.openManageRepos.shortcut,
        footerHint: '',
        footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
      },
      {
        label: t('Add new repository'),
        Icon: PlusSignIcon,
        id: CommandBarStepEnum.ADD_NEW_REPO,
        key: CommandBarStepEnum.ADD_NEW_REPO,
        shortcut: ['cmd', 'A'],
        footerHint: '',
        footerBtns: [
          {
            label: t('Add'),
            shortcut: ['entr'],
          },
        ],
      },
    ];
    const projectItems: CommandBarItemGeneralType[] = projects
      .map(
        (p): CommandBarItemGeneralType => ({
          label: p.name,
          Icon: MagazineIcon,
          id: `project-${p.id}`,
          key: `project-${p.id}`,
          onClick: () => switchProject(p.id),
          footerHint:
            project?.id === p.id
              ? t('Manage project')
              : t(`Switch to`) + ' ' + p.name,
          footerBtns:
            project?.id === p.id
              ? [{ label: t('Manage'), shortcut: ['entr'] }]
              : [
                  {
                    label: t('Open'),
                    shortcut: ['entr'],
                  },
                ],
        }),
      )
      .concat({
        label: t('New project'),
        Icon: MagazineIcon,
        id: CommandBarStepEnum.CREATE_PROJECT,
        key: CommandBarStepEnum.CREATE_PROJECT,
        shortcut: globalShortcuts.createNewProject.shortcut,
        footerHint: t('Create new project'),
        footerBtns: [
          {
            label: t('Manage'),
            shortcut: ['entr'],
          },
        ],
      });
    const themeItems: CommandBarItemGeneralType[] = [
      {
        label: t(`Theme`),
        Icon: ColorSwitchIcon,
        id: CommandBarStepEnum.TOGGLE_THEME,
        key: CommandBarStepEnum.TOGGLE_THEME,
        shortcut: globalShortcuts.toggleTheme.shortcut,
        footerHint: t(`Change application colour theme`),
        footerBtns: [
          {
            label: t('Select'),
            shortcut: ['entr'],
          },
        ],
      },
    ];
    const otherCommands: CommandBarItemGeneralType[] = [
      {
        label: t(`Close all tabs`),
        Icon: CloseSignInCircleIcon,
        id: `close-tabs`,
        key: `close-tabs`,
        onClick: globalShortcuts.closeAllTabs.action,
        shortcut: globalShortcuts.closeAllTabs.shortcut,
        footerHint: t(`Close all open tabs`),
        footerBtns: [
          {
            label: t('Close'),
            shortcut: ['entr'],
          },
        ],
      },
      {
        label: t(`Account settings`),
        Icon: CogIcon,
        id: `account-settings`,
        key: `account-settings`,
        onClick: globalShortcuts.openSettings.action,
        shortcut: globalShortcuts.openSettings.shortcut,
        footerHint: t(`Open account settings`),
        footerBtns: [
          {
            label: t('Open'),
            shortcut: ['entr'],
          },
        ],
      },
      {
        label: t(`Subscription`),
        Icon: WalletIcon,
        id: `subscription-settings`,
        key: `subscription-settings`,
        onClick: globalShortcuts.openSubscriptionSettings.action,
        shortcut: globalShortcuts.openSubscriptionSettings.shortcut,
        footerHint: t(`Open subscription settings`),
        footerBtns: [
          {
            label: t('Open'),
            shortcut: ['entr'],
          },
        ],
      },
      {
        label: t(`Documentation`),
        Icon: DocumentsIcon,
        id: `app-docs`,
        key: `app-docs`,
        onClick: globalShortcuts.openAppDocs.action,
        shortcut: globalShortcuts.openAppDocs.shortcut,
        footerHint: t(`View bloop app documentation on our website`),
        footerBtns: [
          {
            label: t('Open'),
            shortcut: ['entr'],
          },
        ],
      },
      {
        label: t(`Report a bug`),
        Icon: BugIcon,
        id: `bug`,
        key: `bug`,
        onClick: globalShortcuts.reportABug.action,
        shortcut: globalShortcuts.reportABug.shortcut,
        footerHint: t(`Report a bug`),
        footerBtns: [
          {
            label: t('Open'),
            shortcut: ['entr'],
          },
        ],
      },
      {
        label: t(`Sign out`),
        Icon: DoorOutIcon,
        id: `sign-out`,
        key: `sign-out`,
        onClick: globalShortcuts.signOut.action,
        shortcut: globalShortcuts.signOut.shortcut,
        footerHint: t(`Sign out`),
        footerBtns: [
          {
            label: t('Sign out'),
            shortcut: ['entr'],
          },
        ],
      },
      {
        label: t(`Regex search`),
        Icon: RegexIcon,
        id: `toggle-regex`,
        key: `toggle-regex`,
        onClick: globalShortcuts.toggleRegex.action,
        shortcut: globalShortcuts.toggleRegex.shortcut,
        footerHint: t(`Search your repositories using RegExp`),
        footerBtns: [
          {
            label: t('Toggle'),
            shortcut: ['entr'],
          },
        ],
      },
      {
        label: t(`Search files`),
        Icon: MagnifyToolIcon,
        id: CommandBarStepEnum.SEARCH_FILES,
        key: CommandBarStepEnum.SEARCH_FILES,
        shortcut: globalShortcuts.openSearchFiles.shortcut,
        footerHint: t(`Search your files in this project`),
        footerBtns: [
          {
            label: t('Search'),
            shortcut: ['entr'],
          },
        ],
      },
    ];
    const commandsItems = [...themeItems, ...otherCommands];
    const newTabItems = [
      {
        label: t('New chat'),
        Icon: ChatBubblesIcon,
        id: 'new chat',
        key: 'new_chat',
        onClick: () => openNewTab({ type: TabTypesEnum.CHAT }),
        shortcut: ['option', 'N'],
        closeOnClick: true,
        footerHint: '',
        footerBtns: [
          {
            label: t('Open'),
            shortcut: ['entr'],
          },
        ],
      },
    ];
    const chatItems: CommandBarItemGeneralType[] = (
      project?.conversations || []
    )
      .slice(-5)
      .map((c) => ({
        label: c.title,
        id: `chat-${c.id}`,
        key: `chat-${c.id}`,
        Icon: ChatBubblesIcon,
        closeOnClick: true,
        onClick: () => {
          openNewTab({
            type: TabTypesEnum.CHAT,
            title: c.title,
            conversationId: c.id,
          });
        },
        footerHint: '',
        footerBtns: [{ label: t('Open'), shortcut: ['entr'] }],
      }));
    return bubbleUpRecentItems(
      [
        ...(newTabItems.length
          ? [
              {
                items: newTabItems,
                itemsOffset: 0,
                key: 'new-tab-items',
              },
            ]
          : []),
        ...(tabItems.length
          ? [
              {
                items: tabItems,
                itemsOffset: newTabItems.length,
                key: 'tab-items',
              },
            ]
          : []),
        ...(chatItems.length
          ? [
              {
                label: t('Recent conversations'),
                items: chatItems,
                itemsOffset: newTabItems.length + tabItems.length,
                key: 'chat-items',
              },
            ]
          : []),
        {
          items: contextItems,
          itemsOffset: newTabItems.length + tabItems.length + chatItems.length,
          label: t('Manage context'),
          key: 'context-items',
        },
        {
          items: projectItems,
          itemsOffset:
            newTabItems.length +
            tabItems.length +
            chatItems.length +
            contextItems.length,
          label: t('Recent projects'),
          key: 'recent-projects',
        },
        {
          items: commandsItems,
          itemsOffset:
            newTabItems.length +
            tabItems.length +
            chatItems.length +
            contextItems.length +
            projectItems.length,
          label: t('Commands'),
          key: 'general-commands',
        },
      ],
      recentKeys || [],
      t('Recently used'),
    );
  }, [t, projects, project, theme, globalShortcuts, tabItems, openNewTab]);

  const sectionsToShow = useMemo(() => {
    if (!inputValue) {
      return initialSections;
    }
    const newSections: CommandBarSectionType[] = [];
    initialSections.forEach((s) => {
      const newItems = (s.items as CommandBarItemGeneralType[]).filter((i) =>
        i.label.toLowerCase().includes(inputValue.toLowerCase()),
      );
      if (newItems.length) {
        newSections.push({
          ...s,
          items: newItems,
          itemsOffset: newSections[newSections.length - 1]
            ? newSections[newSections.length - 1].items.length +
              newSections[newSections.length - 1].itemsOffset
            : 0,
        });
      }
    });
    return newSections;
  }, [inputValue, initialSections]);

  return (
    <div className="w-full flex flex-col h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={[project?.name || 'Default project']}
        value={inputValue}
        onChange={handleInputChange}
      />
      {!!sectionsToShow.length ? (
        <Body sections={sectionsToShow} />
      ) : (
        <div className="flex-1 items-center justify-center text-label-muted text-center py-2">
          <Trans>No commands found...</Trans>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default memo(InitialCommandBar);
