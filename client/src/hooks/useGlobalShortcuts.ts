import { useContext, useMemo } from 'react';
import { Theme } from '../types';
import { UIContext } from '../context/uiContext';
import { CommandBarStepEnum, SettingSections } from '../types/general';
import { CommandBarContext } from '../context/commandBarContext';

export const useGlobalShortcuts = () => {
  const { setTheme } = useContext(UIContext.Theme);
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );

  const toggleLightTheme = useMemo(() => {
    return {
      shortcut: ['option', '1'],
      action: () => setTheme('light'),
    };
  }, []);

  const toggleDarkTheme = useMemo(() => {
    return {
      shortcut: ['option', '2'],
      action: () => setTheme('dark'),
    };
  }, []);

  const toggleBlackTheme = useMemo(() => {
    return {
      shortcut: ['option', '3'],
      action: () => setTheme('black'),
    };
  }, []);

  const toggleSystemTheme = useMemo(() => {
    return {
      shortcut: ['option', '4'],
      action: () => setTheme('system'),
    };
  }, []);

  const openPrivateRepos = useMemo(() => {
    return {
      shortcut: ['cmd', 'P'],
      action: () => {
        setChosenStep({ id: CommandBarStepEnum.PRIVATE_REPOS });
        setIsVisible(true);
      },
    };
  }, []);

  const openPublicRepos = useMemo(() => {
    return {
      shortcut: ['cmd', 'shift', 'P'],
      action: () => {
        setChosenStep({ id: CommandBarStepEnum.PUBLIC_REPOS });
        setIsVisible(true);
      },
    };
  }, []);

  const openLocalRepos = useMemo(() => {
    return {
      shortcut: ['cmd', 'shift', 'O'],
      action: () => {
        setChosenStep({ id: CommandBarStepEnum.LOCAL_REPOS });
        setIsVisible(true);
      },
    };
  }, []);

  const openAddDocs = useMemo(() => {
    return {
      shortcut: ['cmd', 'D'],
      action: () => {
        setChosenStep({ id: CommandBarStepEnum.DOCS });
        setIsVisible(true);
      },
    };
  }, []);

  const openManageRepos = useMemo(() => {
    return {
      shortcut: ['option', 'R'],
      action: () => {
        setChosenStep({ id: CommandBarStepEnum.MANAGE_REPOS });
        setIsVisible(true);
      },
    };
  }, []);

  return {
    toggleLightTheme,
    toggleBlackTheme,
    toggleDarkTheme,
    toggleSystemTheme,
    openPrivateRepos,
    openPublicRepos,
    openLocalRepos,
    openAddDocs,
    openManageRepos,
  };
};
