import { memo, useCallback } from 'react';
import LocalReposStep from '../../Onboarding/LocalReposStep';
import GithubReposStep from '../../Onboarding/GithubReposStep';
import SeparateOnboardingStep from '../../../components/SeparateOnboardingStep';
import PublicGithubReposStep from '../../Onboarding/PublicGithubReposStep';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';

type Props = {
  addRepos: null | 'local' | 'github' | 'public';
  onClose: (submitted: boolean) => void;
};

const AddRepos = ({ addRepos, onClose }: Props) => {
  const handleClose = () => {
    onClose(false);
  };
  const handleSubmit = () => {
    onClose(true);
  };
  const handleEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }, []);
  useKeyboardNavigation(handleEvent);
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

export default memo(AddRepos);
