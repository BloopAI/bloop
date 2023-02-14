import React, { useCallback, useState } from 'react';
import Step2 from '../../../../pages/Home/Onboarding/LocalReposStep';
import Step4 from '../../../../pages/Home/Onboarding/GithubReposStep';
import Step1 from '../../../../pages/Home/Onboarding/FolderSelectStep';
import SeparateOnboardingStep from '../../../SeparateOnboardingStep';

type Props = {
  addRepos: null | 'local' | 'github';
  onClose: () => void;
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
    <SeparateOnboardingStep isVisible={!!addRepos} onClose={handleClose}>
      {addRepos === 'local' ? (
        isFolderChosen ? (
          <Step2 handleNext={onClose} />
        ) : (
          <Step1 handleNext={onFolderChosen} />
        )
      ) : (
        <Step4 handleNext={onClose} />
      )}
    </SeparateOnboardingStep>
  );
};

export default AddRepos;
