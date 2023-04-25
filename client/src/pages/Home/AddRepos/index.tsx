import React, { useCallback, useState } from 'react';
import LocalReposStep from '../../Onboarding/LocalReposStep';
import GithubReposStep from '../../Onboarding/GithubReposStep';
import FolderSelectStep from '../../Onboarding/FolderSelectStep';
import SeparateOnboardingStep from '../../../components/SeparateOnboardingStep';
import PublicGithubReposStep from '../../Onboarding/PublicGithubReposStep';

type Props = {
  addRepos: null | 'local' | 'github' | 'public';
  onClose: (submitted: boolean) => void;
};

const AddRepos = ({ addRepos, onClose }: Props) => {
  const [isFolderChosen, setFolderChosen] = useState(false);
  const onFolderChosen = useCallback(() => {
    setFolderChosen(true);
  }, []);
  const handleClose = () => {
    setFolderChosen(false);
    onClose(false);
  };
  const handleSubmit = () => {
    onClose(true);
  };
  return (
    <SeparateOnboardingStep isVisible={!!addRepos} onClose={handleClose}>
      {addRepos === 'local' ? (
        <LocalReposStep handleNext={handleSubmit} />
      ) : addRepos === 'github' ? (
        <GithubReposStep handleNext={handleSubmit} disableSkip />
      ) : (
        <PublicGithubReposStep handleNext={handleSubmit} disableSkip />
      )}
    </SeparateOnboardingStep>
  );
};

export default AddRepos;
