import {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectContext } from '../../context/projectContext';
import {
  BugIcon,
  CogIcon,
  DocumentsIcon,
  DoorOutIcon,
  GlobeIcon,
  HardDriveIcon,
  MacintoshIcon,
  MagazineIcon,
  RepositoryIcon,
  ThemeBlackIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
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
  SettingSections,
} from '../../types/general';
import { UIContext } from '../../context/uiContext';
import { Theme } from '../../types';
import { DeviceContext } from '../../context/deviceContext';
import { useSignOut } from '../../hooks/useSignOut';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';

type Props = {};

const InitialCommandBar = ({}: Props) => {
  const { t } = useTranslation();
  const { setIsVisible } = useContext(CommandBarContext.Handlers);
  const { projects } = useContext(ProjectContext.All);
  const { setCurrentProjectId, project } = useContext(ProjectContext.Current);
  const { theme } = useContext(UIContext.Theme);
  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const { openLink } = useContext(DeviceContext);
  const { setSettingsOpen, setSettingsSection } = useContext(
    UIContext.Settings,
  );
  const [inputValue, setInputValue] = useState('');
  const handleSignOut = useSignOut();
  const globalShortcuts = useGlobalShortcuts();

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const switchProject = useCallback((id: string) => {
    setCurrentProjectId(id);
    setIsVisible(false);
  }, []);

  const openGeneralSettings = useCallback(() => {
    setSettingsSection(SettingSections.GENERAL);
    setSettingsOpen(true);
    setIsVisible(false);
  }, []);

  const openSubscriptionSettings = useCallback(() => {
    setSettingsSection(SettingSections.SUBSCRIPTION);
    setSettingsOpen(true);
    setIsVisible(false);
  }, []);

  const reportBug = useCallback(() => {
    setBugReportModalOpen(true);
    setIsVisible(false);
  }, []);

  const signOut = useCallback(() => {
    handleSignOut();
    setIsVisible(false);
  }, []);

  const initialSections = useMemo(() => {
    const contextItems: CommandBarItemGeneralType[] = [
      {
        label: t('Private repositories'),
        Icon: RepositoryIcon,
        id: CommandBarStepEnum.PRIVATE_REPOS,
        key: 'private',
        shortcut: globalShortcuts.openPrivateRepos.shortcut,
        footerHint: t('Any repository from your private GitHub account'),
        footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
      },
      {
        label: t('Public repositories'),
        Icon: GlobeIcon,
        id: CommandBarStepEnum.PUBLIC_REPOS,
        key: 'public',
        shortcut: globalShortcuts.openPublicRepos.shortcut,
        footerHint: t('Any public repository hosted on GitHub'),
        footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
      },
      {
        label: t('Local repositories'),
        Icon: HardDriveIcon,
        id: CommandBarStepEnum.LOCAL_REPOS,
        key: 'local',
        shortcut: globalShortcuts.openLocalRepos.shortcut,
        footerHint: t('Add a repository from your local machine'),
        footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
      },
      {
        label: t('Documentation'),
        Icon: MagazineIcon,
        id: CommandBarStepEnum.DOCS,
        key: 'docs',
        shortcut: globalShortcuts.openAddDocs.shortcut,
        footerHint: t('Add library documentation'),
        footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
      },
    ];
    const projectItems: CommandBarItemGeneralType[] = projects
      .map(
        (p, i): CommandBarItemGeneralType => ({
          label: p.name,
          Icon: MagazineIcon,
          id: `project-${p.id}`,
          key: p.id,
          shortcut: i < 9 ? ['cmd', (i + 1).toString()] : undefined,
          onClick: () => switchProject(p.id),
          footerHint:
            project?.id === p.id
              ? t('Manage project')
              : t(`Switch to`) + ' ' + p.name,
          footerBtns:
            project?.id === p.id
              ? [{ label: t('Manage'), shortcut: ['entr'], action: () => {} }]
              : [
                  {
                    label: t('Open'),
                    shortcut: ['entr'],
                    action: () => switchProject(p.id),
                  },
                ],
        }),
      )
      .concat({
        label: t('New project'),
        Icon: MagazineIcon,
        id: CommandBarStepEnum.CREATE_PROJECT,
        key: 'new-project',
        shortcut: ['cmd', 'N'],
        footerHint: t('Create new project'),
        footerBtns: [
          {
            label: t('Manage'),
            shortcut: ['entr'],
          },
        ],
      });
    const themeOptions = (
      ['light', 'dark', 'black', 'system'] as Theme[]
    ).filter((t) => t !== theme);
    const themeMap = {
      light: {
        icon: ThemeLightIcon,
        shortcut: globalShortcuts.toggleLightTheme.shortcut,
        action: globalShortcuts.toggleLightTheme.action,
      },
      dark: {
        icon: ThemeDarkIcon,
        shortcut: globalShortcuts.toggleDarkTheme.shortcut,
        action: globalShortcuts.toggleDarkTheme.action,
      },
      black: {
        icon: ThemeBlackIcon,
        shortcut: globalShortcuts.toggleBlackTheme.shortcut,
        action: globalShortcuts.toggleBlackTheme.action,
      },
      system: {
        icon: MacintoshIcon,
        shortcut: globalShortcuts.toggleSystemTheme.shortcut,
        action: globalShortcuts.toggleSystemTheme.action,
      },
    };
    const themeItems: CommandBarItemGeneralType[] = themeOptions.map(
      (theme) => ({
        label: t(`Toggle ${theme} theme`),
        Icon: themeMap[theme].icon,
        id: `${theme}-theme`,
        key: `${theme}-theme`,
        onClick: themeMap[theme].action,
        shortcut: themeMap[theme].shortcut,
        footerHint: t(`Use ${theme} theme`),
        footerBtns: [
          {
            label: t('Select'),
            shortcut: ['entr'],
            action: themeMap[theme].action,
          },
        ],
      }),
    );
    const otherCommands: CommandBarItemGeneralType[] = [
      {
        label: t(`Account settings`),
        Icon: CogIcon,
        id: `account-settings`,
        key: `account-settings`,
        onClick: openGeneralSettings,
        shortcut: ['option', 'A'],
        footerHint: t(`Open account settings`),
        footerBtns: [
          {
            label: t('Open'),
            shortcut: ['entr'],
            action: openGeneralSettings,
          },
        ],
      },
      {
        label: t(`Subscription`),
        Icon: WalletIcon,
        id: `subscription-settings`,
        key: `subscription-settings`,
        onClick: openSubscriptionSettings,
        shortcut: ['option', 'S'],
        footerHint: t(`Open subscription settings`),
        footerBtns: [
          {
            label: t('Open'),
            shortcut: ['entr'],
            action: openSubscriptionSettings,
          },
        ],
      },
      {
        label: t(`Documentation`),
        Icon: DocumentsIcon,
        id: `app-docs`,
        key: `app-docs`,
        onClick: () => openLink('https://bloop.ai/docs'),
        shortcut: ['option', 'D'],
        footerHint: t(`View bloop app documentation on our website`),
        footerBtns: [
          {
            label: t('Open'),
            shortcut: ['entr'],
            action: () => openLink('https://bloop.ai/docs'),
          },
        ],
      },
      {
        label: t(`Report a bug`),
        Icon: BugIcon,
        id: `bug`,
        key: `bug`,
        onClick: reportBug,
        shortcut: ['option', 'B'],
        footerHint: t(`Report a bug`),
        footerBtns: [
          {
            label: t('Open'),
            shortcut: ['entr'],
            action: reportBug,
          },
        ],
      },
      {
        label: t(`Sign out`),
        Icon: DoorOutIcon,
        id: `sign-out`,
        key: `sign-out`,
        onClick: signOut,
        shortcut: ['option', 'shift', 'Q'],
        footerHint: t(`Sign out`),
        footerBtns: [
          {
            label: t('Sign out'),
            shortcut: ['entr'],
            action: signOut,
          },
        ],
      },
    ];
    const commandsItems = [...themeItems, ...otherCommands];
    return [
      {
        items: contextItems,
        itemsOffset: 0,
        label: t('Manage context'),
        key: 'context-items',
      },
      {
        items: projectItems,
        itemsOffset: contextItems.length,
        label: t('Recent projects'),
        key: 'recent-projects',
      },
      {
        items: commandsItems,
        itemsOffset: contextItems.length + projectItems.length,
        label: t('Commands'),
        key: 'general-commands',
      },
    ];
  }, [t, projects, project, theme, globalShortcuts]);

  const sectionsToShow = useMemo(() => {
    if (!inputValue) {
      return initialSections;
    }
    const newSections: CommandBarSectionType[] = [];
    initialSections.forEach((s) => {
      const newItems = s.items.filter((i) =>
        i.label.toLowerCase().startsWith(inputValue.toLowerCase()),
      );
      if (newItems.length) {
        newSections.push({ ...s, items: newItems });
      }
    });
    return newSections;
  }, [inputValue, initialSections]);

  return (
    <div className="w-full flex flex-col max-h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={[project?.name || 'Default project']}
        value={inputValue}
        onChange={handleInputChange}
      />
      {!!sectionsToShow.length && <Body sections={sectionsToShow} />}
      <Footer />
    </div>
  );
};

export default memo(InitialCommandBar);
