import { memo, useCallback, useContext, useMemo } from 'react';
import Modal from '../components/Modal';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { CommandBarStepEnum } from '../types/general';
import { CommandBarContext } from '../context/commandBarContext';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { checkEventKeys } from '../utils/keyboardUtils';
import { EnvContext } from '../context/envContext';
import { UIContext } from '../context/uiContext';
import Initial from './steps/Initial';
import PrivateRepos from './steps/PrivateRepos';
import PublicRepos from './steps/PublicRepos';
import LocalRepos from './steps/LocalRepos';
import Documentation from './steps/Documentation';
import CreateProject from './steps/CreateProject';
import ManageRepos from './steps/ManageRepos';
import AddNewRepo from './steps/AddNewRepo';
import ToggleTheme from './steps/ToggleTheme';
import SearchFiles from './steps/SeachFiles';
import AddFileToStudio from './steps/AddToStudio';
import SearchDocs from './steps/SeachDocs';

type Props = {};

const CommandBar = ({}: Props) => {
  const { chosenStep } = useContext(CommandBarContext.CurrentStep);
  const { isVisible } = useContext(CommandBarContext.General);
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const { envConfig } = useContext(EnvContext);
  const { onBoardingState } = useContext(UIContext.Onboarding);
  const globalShortcuts = useGlobalShortcuts();

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setChosenStep({
      id: CommandBarStepEnum.INITIAL,
    });
  }, []);

  const shouldShowTutorial = useMemo(() => {
    return (
      !envConfig?.bloop_user_profile?.is_tutorial_finished &&
      !onBoardingState.isCommandBarTutorialFinished
    );
  }, [envConfig?.bloop_user_profile, onBoardingState]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['cmd', 'K'])) {
        e.stopPropagation();
        e.preventDefault();
        setIsVisible(true);
      }
      Object.values(globalShortcuts).forEach((s) => {
        if (checkEventKeys(e, s.shortcut)) {
          e.stopPropagation();
          e.preventDefault();
          s.action();
        }
      });
    },
    [isVisible, globalShortcuts],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <Modal
      isVisible={isVisible}
      onClose={handleClose}
      noBg
      containerClassName={
        'h-[28.875rem] !z-90 bg-bg-base border border-bg-border backdrop-blur-8 shadow-float'
      }
    >
      {chosenStep.id === CommandBarStepEnum.INITIAL ? (
        <Initial shouldShowTutorial={shouldShowTutorial} />
      ) : chosenStep.id === CommandBarStepEnum.PRIVATE_REPOS ? (
        <PrivateRepos shouldShowTutorial={shouldShowTutorial} />
      ) : chosenStep.id === CommandBarStepEnum.PUBLIC_REPOS ? (
        <PublicRepos />
      ) : chosenStep.id === CommandBarStepEnum.LOCAL_REPOS ? (
        <LocalRepos />
      ) : chosenStep.id === CommandBarStepEnum.DOCS ? (
        <Documentation />
      ) : chosenStep.id === CommandBarStepEnum.CREATE_PROJECT ? (
        <CreateProject />
      ) : chosenStep.id === CommandBarStepEnum.MANAGE_REPOS ? (
        <ManageRepos shouldShowTutorial={shouldShowTutorial} />
      ) : chosenStep.id === CommandBarStepEnum.ADD_NEW_REPO ? (
        <AddNewRepo shouldShowTutorial={shouldShowTutorial} />
      ) : chosenStep.id === CommandBarStepEnum.TOGGLE_THEME ? (
        <ToggleTheme />
      ) : chosenStep.id === CommandBarStepEnum.SEARCH_FILES ? (
        <SearchFiles {...(chosenStep.data || {})} />
      ) : chosenStep.id === CommandBarStepEnum.SEARCH_DOCS ? (
        <SearchDocs {...chosenStep.data} />
      ) : chosenStep.id === CommandBarStepEnum.ADD_TO_STUDIO ? (
        <AddFileToStudio {...chosenStep.data} />
      ) : null}
    </Modal>
  );
};

export default memo(CommandBar);
