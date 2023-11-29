import { memo, useCallback, useContext } from 'react';
import Modal from '../components/Modal';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { CommandBarStepEnum } from '../types/general';
import { CommandBarContext } from '../context/commandBarContext';
import { isFocusInInput } from '../utils/domUtils';
import Initial from './steps/Initial';
import PrivateRepos from './steps/PrivateRepos';
import PublicRepos from './steps/PublicRepos';
import LocalRepos from './steps/LocalRepos';
import Documentation from './steps/Documentation';
import CreateProject from './steps/CreateProject';

type Props = {};

const CommandBar = ({}: Props) => {
  const { chosenStep } = useContext(CommandBarContext.CurrentStep);
  const { isVisible, setIsVisible } = useContext(CommandBarContext.General);
  const { setChosenStep } = useContext(CommandBarContext.Handlers);
  const handleClose = useCallback(() => {
    setIsVisible(false);
    setChosenStep({
      id: CommandBarStepEnum.INITIAL,
    });
  }, []);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'k' && !isFocusInInput()) {
        e.stopPropagation();
        e.preventDefault();
        setIsVisible(true);
      }
    },
    [isVisible],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <Modal
      isVisible={isVisible}
      onClose={handleClose}
      containerClassName={'max-h-[28.875rem] w-full max-w-[40rem]'}
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
      ) : null}
    </Modal>
  );
};

export default memo(CommandBar);
