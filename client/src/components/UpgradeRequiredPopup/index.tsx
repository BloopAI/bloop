import { memo, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Modal from '../Modal';
import Button from '../Button';
import { CloseSignIcon } from '../../icons';
import { UIContext } from '../../context/uiContext';
import { SettingSections } from '../../types/general';
import BranchesSvg from './BranchesSvg';

type Props = {};

const UpgradeRequiredPopup = ({}: Props) => {
  const { t } = useTranslation();
  const { setSettingsOpen, setSettingsSection } = useContext(
    UIContext.Settings,
  );
  const { isUpgradeRequiredPopupOpen, setIsUpgradeRequiredPopupOpen } =
    useContext(UIContext.UpgradeRequiredPopup);

  const handleUpgrade = useCallback(() => {
    setSettingsSection(SettingSections.SUBSCRIPTION);
    setSettingsOpen(true);
    setIsUpgradeRequiredPopupOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsUpgradeRequiredPopupOpen(false);
  }, []);

  return (
    <Modal
      isVisible={isUpgradeRequiredPopupOpen}
      onClose={handleClose}
      containerClassName="max-w-[34rem] max-h-[80vh]"
    >
      <div className="relative bg-bg-shade overflow-auto">
        <div>
          <BranchesSvg />
        </div>
        <div className="py-8 px-6 flex flex-col gap-4 items-center">
          <div className="flex flex-col gap-3 text-center">
            <h4 className="h4 text-label-title">
              <Trans>GitHub Branches</Trans>
            </h4>
            <p className="body-s text-label-base">
              <button
                className="text-brand-default hover:text-brand-default-hover cursor-pointer"
                onClick={handleUpgrade}
              >
                <Trans>Upgrade now</Trans>
              </button>{' '}
              <Trans>
                to seamlessly explore code across all branches in your GitHub
                repositories, maximizing your code discovery capabilities.
              </Trans>
            </p>
          </div>
          <Button onClick={handleUpgrade}>
            <Trans>Upgrade plan</Trans>
          </Button>
        </div>
        <div className="absolute top-2 right-2">
          <Button
            onlyIcon
            title={t('Close')}
            variant="tertiary"
            size="small"
            onClick={handleClose}
          >
            <CloseSignIcon sizeClassName="w-5 h-5" />
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(UpgradeRequiredPopup);
