import { AnimatePresence, motion } from 'framer-motion';
import React, { MouseEvent, PropsWithChildren, useCallback } from 'react';
import {
  MODAL_SIDEBAR_APPEAR_ANIMATION,
  MODAL_SIDEBAR_CHANGE_ANIMATION,
} from '../../consts/animations';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';

type Props = {
  isSidebar: boolean;
  shouldShow: boolean;
  onClose: (e: MouseEvent) => void;
  shouldStretch?: boolean;
  isModalSidebarTransition: boolean;
  setIsModalSidebarTransition: (b: boolean) => void;
  containerClassName?: string;
  fullOverlay?: boolean;
  filtersOverlay?: boolean;
};

const modalAnimation = (shouldStretch: boolean) => ({
  top: '5rem',
  ...(shouldStretch ? { bottom: '5rem' } : {}),
  right: '50%',
  transform: 'translate(50%, 0%)',
  opacity: 1,
});

const sidebarAnimation = (shouldStretch: boolean) => ({
  top: '4rem',
  ...(shouldStretch ? { bottom: '4rem' } : {}),
  right: '0%',
  transform: 'translate(0%, 0%)',
  opacity: 1,
});

const initialModalStyles = (shouldStretch: boolean) => ({
  top: '5rem',
  ...(shouldStretch ? { bottom: '5rem' } : {}),
  right: '50%',
  transform: 'translate(50%, 1rem)',
  opacity: 0,
});

const initialSidebarStyles = (shouldStretch: boolean) => ({
  top: '4rem',
  right: '0%',
  ...(shouldStretch ? { bottom: '4rem' } : {}),
  transform: 'translate(4rem, 0%)',
  opacity: 0,
});

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

const ModalOrSidebar = ({
  children,
  isSidebar,
  shouldShow,
  onClose,
  isModalSidebarTransition,
  setIsModalSidebarTransition,
  containerClassName = '',
  shouldStretch = true,
  fullOverlay,
  filtersOverlay,
}: PropsWithChildren<Props>) => {
  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && shouldShow) {
      e.stopPropagation();
      e.preventDefault();
      // @ts-ignore
      onClose(e);
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent);

  return (
    <>
      <AnimatePresence>
        {shouldShow && !isSidebar && (
          <motion.div
            className={`fixed top-0 ${
              fullOverlay ? '' : 'mt-16'
            } bottom-0 left-0 right-0 bg-gray-900 bg-opacity-75 cursor-alias ${
              fullOverlay ? 'z-60' : 'z-20'
            }`}
            initial={backdropHidden}
            animate={backdropVisible}
            exit={backdropHidden}
            onClick={onClose}
            transition={MODAL_SIDEBAR_APPEAR_ANIMATION}
          />
        )}
      </AnimatePresence>
      {shouldShow && filtersOverlay && (
        <div
          onClick={onClose}
          className="absolute left-0 top-0 bottom-0 w-[20.25rem]"
        />
      )}
      <AnimatePresence>
        {shouldShow && (
          <motion.div
            className={`modal-or-sidebar overflow-hidden fixed flex flex-col ${
              isSidebar ? `border-y-0` : `rounded-md drop-shadow-light-bigger`
            } bg-gray-900 border border-gray-700 bg-opacity-75 z-70 backdrop-blur-8 ${containerClassName}`}
            animate={
              isSidebar
                ? sidebarAnimation(shouldStretch)
                : modalAnimation(shouldStretch)
            }
            initial={
              isSidebar
                ? initialSidebarStyles(shouldStretch)
                : initialModalStyles(shouldStretch)
            }
            exit={
              isSidebar
                ? initialSidebarStyles(shouldStretch)
                : initialModalStyles(shouldStretch)
            }
            transition={
              isModalSidebarTransition
                ? MODAL_SIDEBAR_CHANGE_ANIMATION
                : MODAL_SIDEBAR_APPEAR_ANIMATION
            }
            onAnimationComplete={() => setIsModalSidebarTransition(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ModalOrSidebar;
