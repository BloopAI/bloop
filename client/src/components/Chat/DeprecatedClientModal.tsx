import { useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../Button';
import SeparateOnboardingStep from '../SeparateOnboardingStep';
import { CloseSign } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const DeprecatedClientModal = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation();
  const { openLink, relaunch } = useContext(DeviceContext);
  return (
    <SeparateOnboardingStep isVisible={isOpen} onClose={onClose}>
      <div className="pt-8 relative flex flex-col gap-8 bg-bg-shade overflow-auto">
        <div className="flex flex-col gap-3 text-center">
          <h4 className="text-label-title">
            <Trans>Update Required</Trans>
          </h4>
          <p className="body-s text-label-base text-center">
            <Trans>
              We&apos;ve made some exciting enhancements to bloop! To continue
              enjoying the full functionality, including the natural language
              search feature, please update your app to the latest version.
            </Trans>
          </p>
          <p className="body-s text-label-base text-center">
            <Trans>
              To update your app, please visit our releases page on GitHub and
              download the latest version manually. Thank you for using bloop.
            </Trans>
          </p>
        </div>
        <Button onClick={relaunch}>
          <Trans>Restart the app</Trans>
        </Button>
        <p className="caption text-center -mt-4">
          <Trans>or </Trans>
          <button
            className="text-bg-main hover:text-bg-main-hover"
            onClick={() =>
              openLink('https://github.com/BloopAI/bloop/releases')
            }
          >
            <Trans>visit the downloads page</Trans>
          </button>
        </p>
      </div>
      <div className="absolute top-3 right-3">
        <Button
          variant="tertiary"
          onClick={onClose}
          onlyIcon
          title={t('Close')}
        >
          <CloseSign />
        </Button>
      </div>
    </SeparateOnboardingStep>
  );
};

export default DeprecatedClientModal;
