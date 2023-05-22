import { useContext } from 'react';
import Button from '../Button';
import SeparateOnboardingStep from '../SeparateOnboardingStep';
import { CloseSign } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const DeprecatedClientModal = ({ isOpen, onClose }: Props) => {
  const { openLink, relaunch } = useContext(DeviceContext);
  return (
    <SeparateOnboardingStep isVisible={isOpen} onClose={onClose}>
      <div className="pt-8 relative flex flex-col gap-8 bg-bg-shade overflow-auto">
        <div className="flex flex-col gap-3 text-center">
          <h4 className="text-label-title">Update Required</h4>
          <p className="body-s text-label-base text-center">
            We&apos;ve made some exciting enhancements to our app! To continue
            enjoying the full functionality, including the natural language
            search feature, please update your app to the latest version.
          </p>
          <p className="body-s text-label-base text-center">
            To update your app, please visit our releases page on GitHub and
            download the latest version manually. Thank you for being a valued
            user of our app.
          </p>
        </div>
        <Button onClick={relaunch}>Restart the app</Button>
        <p className="caption text-center -mt-4">
          or{' '}
          <button
            className="text-bg-main hover:text-bg-main-hover"
            onClick={() =>
              openLink('https://github.com/BloopAI/bloop/releases')
            }
          >
            visit the downloads page
          </button>
        </p>
      </div>
      <div className="absolute top-3 right-3">
        <Button variant="tertiary" onClick={onClose} onlyIcon title="Close">
          <CloseSign />
        </Button>
      </div>
    </SeparateOnboardingStep>
  );
};

export default DeprecatedClientModal;
