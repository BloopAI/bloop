import React, { memo, PropsWithChildren, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MODAL_APPEAR_ANIMATION } from '../../consts/animations';
import { isFocusInInput } from '../../utils/domUtils';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';

type Props = {
  isVisible: boolean;
  noBg?: boolean;
  onClose?: () => void;
  containerClassName?: string;
  customKeyHandler?: boolean;
};

const backdropHidden = {
  opacity: 0,
};

const backdropVisible = {
  opacity: 1,
};

const initialModalStyles = {
  top: '50%',
  right: '50%',
  transform: 'translate(50%, -45%)',
  opacity: 0,
};

const modalAnimation = {
  top: '50%',
  right: '50%',
  transform: 'translate(50%, -50%)',
  opacity: 1,
};

const Modal = ({
  onClose,
  children,
  isVisible,
  noBg,
  containerClassName = '',
  customKeyHandler,
}: PropsWithChildren<Props>) => {
  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (!isFocusInInput() && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent, customKeyHandler || !isVisible);

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`fixed top-0 bottom-0 left-0 right-0 bg-bg-sub/50 ${
              onClose ? 'cursor-alias' : ''
            } z-50`}
            initial={backdropHidden}
            animate={backdropVisible}
            exit={backdropHidden}
            onClick={onClose}
            transition={MODAL_APPEAR_ANIMATION}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`fixed flex flex-col rounded-xl ${
              noBg
                ? ''
                : 'bg-bg-base border border-bg-border backdrop-blur-8 shadow-float overflow-auto'
            } ${containerClassName} z-70`}
            animate={modalAnimation}
            initial={initialModalStyles}
            exit={initialModalStyles}
            role="dialog"
            aria-modal="true"
            transition={MODAL_APPEAR_ANIMATION}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default memo(Modal);
