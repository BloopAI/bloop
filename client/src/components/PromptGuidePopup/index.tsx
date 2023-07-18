import React, { useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import ModalOrSidebar from '../ModalOrSidebar';
import Button from '../Button';
import { CloseSign } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';
import { UIContext } from '../../context/uiContext';
import { PROMPT_GUIDE_DONE, savePlainToStorage } from '../../services/storage';
import PromptSvg from './PromptSvg';

const PromptGuidePopup = () => {
  const { t } = useTranslation();
  const { openLink } = useContext(DeviceContext);
  const { isPromptGuideOpen, setPromptGuideOpen } = useContext(UIContext);

  const handlePromptGuideClose = useCallback(() => {
    setPromptGuideOpen(false);
    savePlainToStorage(PROMPT_GUIDE_DONE, 'true');
  }, []);

  return (
    <ModalOrSidebar
      isSidebar={false}
      shouldShow={isPromptGuideOpen}
      onClose={handlePromptGuideClose}
      isModalSidebarTransition={false}
      setIsModalSidebarTransition={() => {}}
      shouldStretch={false}
      fullOverlay
      containerClassName="max-w-lg"
    >
      <div className="bg-bg-shade border border-bg-border shadow-float rounded-md select-none relative">
        <div className="w-full h-72 overflow-hidden relative">
          <img
            src="/light.png"
            alt=""
            className="fixed -top-44 -right-40 pointer-events-none opacity-[0.16] z-50"
          />
          <PromptSvg />
        </div>
        <div className="flex flex-col items-center gap-8 py-8 px-6">
          <div className="flex flex-col gap-3">
            <h4 className="h4 text-label-title">
              <Trans>Prompt guide</Trans>
            </h4>
            <p className="body-s text-label-base">
              <Trans>
                Like ChatGPT, bloop responds best to certain prompts. We’ve
                compiled a really quick guide on how better to prompt bloop.
              </Trans>
            </p>
          </div>
          <div className="flex justify-between gap-3 w-full">
            <Button variant="tertiary" onClick={handlePromptGuideClose}>
              <Trans>Skip (Not recommended)</Trans>
            </Button>
            <Button
              onClick={() => {
                openLink('https://bloop.ai/docs');
                handlePromptGuideClose();
              }}
            >
              <Trans>Take a quick look</Trans>
            </Button>
          </div>
        </div>
        <div className="absolute top-2 right-2">
          <Button
            onlyIcon
            title={t('Close')}
            variant="tertiary"
            size="small"
            onClick={handlePromptGuideClose}
          >
            <CloseSign />
          </Button>
        </div>
      </div>
    </ModalOrSidebar>
  );
};

export default PromptGuidePopup;
