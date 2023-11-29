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
  MacintoshIcon,
  MagazineIcon,
  ThemeBlackIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
  WalletIcon,
} from '../../icons';
import { CommandBarContext } from '../../context/commandBarContext';
import Header from '../Header';
import Body from '../Body';
import Footer from '../Footer';
import { getContextItems } from '../items';
import {
  CommandBarItemGeneralType,
  CommandBarSectionType,
  CommandBarStepEnum,
} from '../../types/general';
import { UIContext } from '../../context/uiContext';
import { Theme } from '../../types';
import { SettingSections } from '../../old_stuff/components/Settings';
import { DeviceContext } from '../../context/deviceContext';
import { useSignOut } from '../../hooks/useSignOut';

type Props = {};

const InitialCommandBar = ({}: Props) => {
  const { t } = useTranslation();
  const { setIsVisible } = useContext(CommandBarContext.General);
  const { projects } = useContext(ProjectContext.All);
  const { setCurrentProjectId, project } = useContext(ProjectContext.Current);
  const { theme, setTheme } = useContext(UIContext.Theme);
  const { setBugReportModalOpen } = useContext(UIContext.BugReport);
  const { openLink } = useContext(DeviceContext);
  const { setSettingsOpen, setSettingsSection } = useContext(
    UIContext.Settings,
  );
  const [inputValue, setInputValue] = useState('');
  const handleSignOut = useSignOut();

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
    const contextItems: CommandBarItemGeneralType[] = getContextItems(t);
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
    const themeIconsMap = {
      light: ThemeLightIcon,
      dark: ThemeDarkIcon,
      black: ThemeBlackIcon,
      system: MacintoshIcon,
    };
    const themeItems: CommandBarItemGeneralType[] = themeOptions.map(
      (theme, i) => ({
        label: t(`Toggle ${theme} theme`),
        Icon: themeIconsMap[theme],
        id: `${theme}-theme`,
        key: `${theme}-theme`,
        onClick: () => setTheme(theme),
        shortcut: ['option', (i + 1).toString()],
        footerHint: t(`Use ${theme} theme`),
        footerBtns: [
          {
            label: t('Select'),
            shortcut: ['entr'],
            action: () => setTheme(theme),
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
      { items: contextItems, itemsOffset: 0, label: t('Manage context') },
      {
        items: projectItems,
        itemsOffset: contextItems.length,
        label: t('Recent projects'),
      },
      {
        items: commandsItems,
        itemsOffset: contextItems.length + projectItems.length,
        label: t('Commands'),
      },
    ];
  }, [t, projects, project, theme]);

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
