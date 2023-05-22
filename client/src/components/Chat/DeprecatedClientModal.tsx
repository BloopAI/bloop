import Button from '../Button';
import SeparateOnboardingStep from '../SeparateOnboardingStep';
import { CloseSign } from '../../icons';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const DeprecatedClientModal = ({ isOpen, onClose }: Props) => {
  return (
    <SeparateOnboardingStep isVisible={isOpen} onClose={onClose}>
      <div className="pt-8 relative flex flex-col gap-8 bg-bg-shade overflow-auto">
        <div className="flex flex-col gap-3 text-center">
          <h4 className="text-label-title">This app version is deprecated</h4>
          <p className="body-s text-label-base text-center">
            This app version is no longer supported. Search API is disabled.
            Please update the app to continue using search.
          </p>
        </div>
        <Button onClick={onClose}>I understand</Button>
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
