import LocalReposStep from '../../Onboarding/LocalReposStep';
import GithubReposStep from '../../Onboarding/GithubReposStep';
import SeparateOnboardingStep from '../../../components/SeparateOnboardingStep';
import PublicGithubReposStep from '../../Onboarding/PublicGithubReposStep';
import useAnalytics from '../../../hooks/useAnalytics';

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
