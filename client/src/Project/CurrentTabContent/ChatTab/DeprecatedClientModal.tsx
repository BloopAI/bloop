import { useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CloseSignIcon } from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const DeprecatedClientModal = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation();
  const { openLink, relaunch } = useContext(DeviceContext);
  return (
    <Modal isVisible={isOpen} onClose={onClose} noBg>
      <div className="w-[32.75rem] flex flex-col items-start rounded-md border border-bg-border bg-bg-shade shadow-float overflow-hidden">
        <div className="p-10 relative flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h4 className="title-m-b text-label-title">
              <Trans>Update Required</Trans>
            </h4>
            <p className="body-base text-label-base">
              <Trans>
                We&apos;ve made some exciting enhancements to bloop! To continue
                enjoying the full functionality, including the natural language
                search feature, please update your app to the latest version.
              </Trans>
            </p>
            <p className="body-base text-label-base">
              <Trans>
                To update your app, please visit our releases page on GitHub and
                download the latest version manually. Thank you for using bloop.
              </Trans>
            </p>
          </div>
          <div className="flex justify-between items-center">
            <button
              className="body-mini-b text-label-link"
              onClick={() =>
                openLink('https://github.com/BloopAI/bloop/releases')
              }
            >
              <Trans>Visit the downloads page</Trans>
            </button>
            <Button onClick={relaunch}>
              <Trans>Restart the app</Trans>
            </Button>
          </div>
        </div>
        <div className="absolute top-3 right-3">
          <Button
            variant="tertiary"
            size="small"
            onClick={onClose}
            onlyIcon
            title={t('Close')}
          >
            <CloseSignIcon sizeClassName="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeprecatedClientModal;
