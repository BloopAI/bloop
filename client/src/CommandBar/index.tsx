import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import {
  CommandBarActiveStepType,
  CommandBarItemType,
  CommandBarStepEnum,
  CommandBarStepType,
} from '../types/general';
import CommandBarContextProvider from '../context/providers/CommandBarContextProvider';
import { getContextItems, getProjectItems } from './items';
import Initial from './Initial';
import PrivateRepos from './PrivateRepos';
import PublicRepos from './PublicRepos';

type Props = {};

const CommandBar = ({}: Props) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [focusedItem, setFocusedItem] = useState<CommandBarItemType | null>(
    null,
  );
  const [chosenStep, setChosenStep] = useState<{
    id: CommandBarStepEnum;
    data?: Record<string, any>;
  }>({
    id: CommandBarStepEnum.INITIAL,
  });
  const [activeStepShort, setActiveStepShort] = useState<CommandBarStepType>({
    id: 'initial',
    label: '',
  });
  const [activeStepFull, setActiveStepFull] =
    useState<CommandBarActiveStepType>({
      parents: [],
      onBack: () => {},
      sections: [
        {
          items: getContextItems(t),
          itemsOffset: 0,
          label: t('Manage context'),
        },
        {
          items: getProjectItems(t),
          itemsOffset: getContextItems(t).length,
          label: t('Recent projects'),
        },
      ],
    });

  const handleClose = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleBack = useCallback(() => {
    setActiveStepShort((prev) => {
      if (!prev.parent) {
        setIsVisible(false);
        return prev;
      }
      return prev.parent;
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
        ) : null}
      </CommandBarContextProvider>
    </Modal>
  );
};

export default memo(CommandBar);
