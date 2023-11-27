import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import {
  CommandBarActiveStepType,
  CommandBarItemType,
  CommandBarStepType,
} from '../types/general';
import Header from './Header';
import Body from './Body';
import Footer from './Footer';
import {
  getActiveStepContent,
  getContextItems,
  getProjectItems,
} from './items';

type Props = {};

const CommandBar = ({}: Props) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [focusedItem, setFocusedItem] = useState<CommandBarItemType | null>(
    null,
  );
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
      } else if (e.key === 'Escape' && isVisible) {
        e.stopPropagation();
        e.preventDefault();
        handleBack();
      }
    },
    [isVisible],
  );
  useKeyboardNavigation(handleKeyEvent);

  useEffect(() => {
    getActiveStepContent(t, activeStepShort).then(setActiveStepFull);
  }, [activeStepShort, t]);

  return (
    <Modal
      isVisible={isVisible}
      onClose={handleClose}
      containerClassName={'max-h-[28.875rem] w-full max-w-[40rem]'}
    >
      <Header activeStep={activeStepShort} handleBack={handleBack} />
      <Body
        setFocusedItem={setFocusedItem}
        sections={activeStepFull.sections}
        setActiveStep={setActiveStepShort}
      />
      <Footer
        btns={focusedItem?.footerBtns}
        hintText={focusedItem?.footerHint}
      />
    </Modal>
  );
};

export default memo(CommandBar);
