import React, { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Step2 from '../../../../pages/Home/Onboarding/LocalReposStep';
import Step4 from '../../../../pages/Home/Onboarding/GithubReposStep';
import { MODAL_SIDEBAR_APPEAR_ANIMATION } from '../../../../consts/animations';
import Step1 from '../../../../pages/Home/Onboarding/FolderSelectStep';

type Props = {
  addRepos: null | 'local' | 'github';
  onClose: () => void;
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

const initialModalStyles = {
  top: '1rem',
  right: '50%',
  transform: 'translate(50%, 1rem)',
  opacity: 0,
};

const modalAnimation = {
  top: '1rem',
  right: '50%',
  transform: 'translate(50%, 0%)',
  opacity: 1,
};

const AddRepos = ({ addRepos, onClose }: Props) => {
  const [isFolderChosen, setFolderChosen] = useState(false);
  const onFolderChosen = useCallback(() => {
    setFolderChosen(true);
  }, []);
  const handleClose = () => {
    setFolderChosen(false);
    onClose();
  };
  return (
    <>
      <AnimatePresence>
        {!!addRepos && (
          <motion.div
            className={`fixed top-0 bottom-0 left-0 right-0 bg-gray-900 bg-opacity-75 cursor-alias z-50`}
            initial={backdropHidden}
            animate={backdropVisible}
            exit={backdropHidden}
            onClick={handleClose}
            transition={MODAL_SIDEBAR_APPEAR_ANIMATION}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!!addRepos && (
          <motion.div
            className={`overflow-auto fixed flex flex-col rounded-md drop-shadow-light-bigger bg-gray-900 border border-gray-700 bg-opacity-75 z-70 backdrop-blur-8`}
            animate={modalAnimation}
            initial={initialModalStyles}
            exit={initialModalStyles}
            transition={MODAL_SIDEBAR_APPEAR_ANIMATION}
          >
            <div className="p-6 flex flex-col gap-8 w-99 relative max-h-[calc(100vh-13rem)] flex-1">
              {addRepos === 'local' ? (
                isFolderChosen ? (
                  <Step2 handleNext={onClose} />
                ) : (
                  <Step1 handleNext={onFolderChosen} />
                )
              ) : (
                <Step4 handleNext={onClose} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AddRepos;
