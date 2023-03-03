import React, { PropsWithChildren } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MODAL_SIDEBAR_APPEAR_ANIMATION } from '../../consts/animations';

type Props = {
  isVisible: boolean;
  onClose?: () => void;
  top?: string;
};

const backdropHidden = {
  opacity: 0,
  backdropFilter: 'blur(0)',
  '-webkit-background-filter': 'blur(0)',
};

const backdropVisible = {
  opacity: 1,
  backdropFilter: 'blur(1px)',
  '-webkit-backdrop-filter': 'blur(1px)',
};

const initialModalStyles = (top: string) => ({
  top,
  right: '50%',
  transform: 'translate(50%, 1rem)',
  opacity: 0,
});

const modalAnimation = (top: string) => ({
  top,
  right: '50%',
  transform: 'translate(50%, 0%)',
  opacity: 1,
});

const SeparateOnboardingStep = ({
  onClose,
  children,
  isVisible,
  top = '1rem',
}: PropsWithChildren<Props>) => {
  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`fixed top-0 bottom-0 left-0 right-0 bg-gray-900 bg-opacity-75 ${
              onClose ? 'cursor-alias' : ''
            } z-50`}
            initial={backdropHidden}
            animate={backdropVisible}
            exit={backdropHidden}
            onClick={onClose}
            transition={MODAL_SIDEBAR_APPEAR_ANIMATION}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`overflow-auto fixed flex flex-col rounded-md drop-shadow-light-bigger bg-gray-900 
            border border-gray-700 bg-opacity-75 z-70 backdrop-blur-8 max-h-[calc(100%-3rem)]`}
            animate={modalAnimation(top)}
            initial={initialModalStyles(top)}
            exit={initialModalStyles(top)}
            transition={MODAL_SIDEBAR_APPEAR_ANIMATION}
          >
            <div className="p-6 flex flex-col gap-8 w-99 relative flex-1 overflow-auto">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SeparateOnboardingStep;
