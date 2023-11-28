import { memo, useCallback, useState } from 'react';
import Modal from '../components/Modal';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { CommandBarStepEnum } from '../types/general';
import CommandBarContextProvider from '../context/providers/CommandBarContextProvider';
import Initial from './Initial';
import PrivateRepos from './PrivateRepos';
import PublicRepos from './PublicRepos';
import LocalRepos from './LocalRepos';
import Documentation from './Documentation';

type Props = {};

const CommandBar = ({}: Props) => {
  const [isVisible, setIsVisible] = useState(false);
  const [chosenStep, setChosenStep] = useState<{
    id: CommandBarStepEnum;
    data?: Record<string, any>;
  }>({
    id: CommandBarStepEnum.INITIAL,
  });

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setChosenStep({
      id: CommandBarStepEnum.INITIAL,
    });
  }, []);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'k') {
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
      <CommandBarContextProvider
        setChosenStep={setChosenStep}
        isVisible={isVisible}
        setIsVisible={setIsVisible}
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
        ) : null}
      </CommandBarContextProvider>
    </Modal>
  );
};

export default memo(CommandBar);
