import { memo, useCallback, useContext } from 'react';
import Modal from '../components/Modal';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { CommandBarStepEnum } from '../types/general';
import { CommandBarContext } from '../context/commandBarContext';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { checkEventKeys } from '../utils/keyboardUtils';
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

type Props = {};

const CommandBar = ({}: Props) => {
  const { chosenStep } = useContext(CommandBarContext.CurrentStep);
  const { isVisible } = useContext(CommandBarContext.General);
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const globalShortcuts = useGlobalShortcuts();

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setChosenStep({
      id: CommandBarStepEnum.INITIAL,
    });
  }, []);

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
      containerClassName={'h-[28.875rem] w-full max-w-[40rem] !z-90'}
    >
      {chosenStep.id === CommandBarStepEnum.INITIAL ? (
        <Initial />
      ) : chosenStep.id === CommandBarStepEnum.PRIVATE_REPOS ? (
        <PrivateRepos />
      ) : chosenStep.id === CommandBarStepEnum.PUBLIC_REPOS ? (
        <PublicRepos />
      ) : chosenStep.id === CommandBarStepEnum.LOCAL_REPOS ? (
        <LocalRepos />
      ) : chosenStep.id === CommandBarStepEnum.DOCS ? (
        <Documentation />
      ) : chosenStep.id === CommandBarStepEnum.CREATE_PROJECT ? (
        <CreateProject />
      ) : chosenStep.id === CommandBarStepEnum.MANAGE_REPOS ? (
        <ManageRepos />
      ) : chosenStep.id === CommandBarStepEnum.ADD_NEW_REPO ? (
        <AddNewRepo />
      ) : chosenStep.id === CommandBarStepEnum.TOGGLE_THEME ? (
        <ToggleTheme />
      ) : chosenStep.id === CommandBarStepEnum.SEARCH_FILES ? (
        <SearchFiles />
      ) : null}
    </Modal>
  );
};

export default memo(CommandBar);
