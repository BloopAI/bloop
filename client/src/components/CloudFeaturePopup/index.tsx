import React, { useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import ModalOrSidebar from '../ModalOrSidebar';
import Button from '../Button';
import { CloseSign } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';
import BranchesSvg from './BranchesSvg';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const CloudFeaturePopup = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation();
  const { openLink } = useContext(DeviceContext);
  return (
    <ModalOrSidebar
      isSidebar={false}
      shouldShow={isOpen}
      onClose={onClose}
      isModalSidebarTransition={false}
      setIsModalSidebarTransition={() => {}}
      shouldStretch={false}
      fullOverlay
      containerClassName="max-w-[34rem] max-h-[80vh]"
    >
      <div className="relative bg-bg-shade overflow-auto">
        <div>
          <BranchesSvg />
        </div>
        <div className="py-8 px-6 flex flex-col gap-8 items-center">
          <div className="flex flex-col gap-3 text-center">
            <h4 className="h4 text-label-title">
              <Trans>GitHub Branches</Trans>
            </h4>
            <p className="body-s text-label-base">
              <button
                className="text-bg-main hover:text-bg-main-hover cursor-pointer"
                onClick={() => {
                  openLink('https://bloop.ai/start');
                  onClose();
                }}
              >
                <Trans>Upgrade now</Trans>
              </button>{' '}
              <Trans>
                to seamlessly explore code across all branches in your GitHub
                repositories, maximizing your code discovery capabilities.
              </Trans>
            </p>
          </div>
          <Button
            onClick={() => {
              openLink('https://bloop.ai/upgrade');
              onClose();
            }}
          >
            <Trans>Upgrade plan</Trans>
          </Button>
        </div>
        <div className="absolute top-2 right-2">
          <Button
            onlyIcon
            title={t('Close')}
            variant="tertiary"
            size="small"
            onClick={onClose}
          >
            <CloseSign />
          </Button>
        </div>
      </div>
    </ModalOrSidebar>
  );
};

export default CloudFeaturePopup;
