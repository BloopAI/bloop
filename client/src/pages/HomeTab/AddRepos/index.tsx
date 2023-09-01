import { memo, useCallback } from 'react';
import LocalReposStep from '../../Onboarding/LocalReposStep';
import GithubReposStep from '../../Onboarding/GithubReposStep';
import SeparateOnboardingStep from '../../../components/SeparateOnboardingStep';
import PublicGithubReposStep from '../../Onboarding/PublicGithubReposStep';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import AddCodeStudio from './AddCodeStudio';

type Props = {
  addRepos: null | 'local' | 'github' | 'public' | 'studio';
  onClose: (submitted: boolean, name?: string) => void;
};

const AddRepos = ({ addRepos, onClose }: Props) => {
  const handleClose = () => {
    onClose(false);
  };
  const handleSubmit = () => {
    onClose(true);
  };
  const handleSubmitStudio = (name?: string) => {
    onClose(true, name);
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
      ) : addRepos === 'public' ? (
        <PublicGithubReposStep handleNext={handleSubmit} disableSkip />
      ) : (
        <AddCodeStudio handleSubmit={handleSubmitStudio} />
      )}
    </SeparateOnboardingStep>
  );
};

export default memo(AddRepos);
