import React, { memo, useCallback, useContext, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SelectToggleButton from '../../../components/SelectToggleButton';
import { ChevronDoubleIntersected, Modal, Sidebar } from '../../../icons';
import { FullResultModeEnum } from '../../../types/general';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { FileModalContext } from '../../../context/fileModalContext';

type Props = {
  repoName: string;
  relativePath: string;
  mode: FullResultModeEnum;
  setModeAndTransition: (m: FullResultModeEnum) => void;
};

const ModeToggle = ({
  repoName,
  relativePath,
  mode,
  setModeAndTransition,
}: Props) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { navigateFullResult } = useAppNavigation();
  const [isPending, startTransition] = useTransition();
  const { closeFileModalOpen } = useContext(FileModalContext);

  const handleFull = useCallback(() => {
    closeFileModalOpen();
    navigateFullResult(relativePath, {
      scrollToLine: searchParams.get('modalScrollToLine') || '',
    });
  }, [searchParams, relativePath, closeFileModalOpen]);

  const handleModal = useCallback(() => {
    startTransition(() => {
      setModeAndTransition(FullResultModeEnum.MODAL);
    });
  }, []);

  const handleSidebar = useCallback(() => {
    startTransition(() => {
      setModeAndTransition(FullResultModeEnum.SIDEBAR);
    });
  }, []);

  return (
    <div className="flex gap-2">
      <SelectToggleButton
        onlyIcon
        onClick={handleFull}
        selected={false}
        title={t('Open in full view')}
      >
        <ChevronDoubleIntersected />
      </SelectToggleButton>
      <SelectToggleButton
        onlyIcon
        onClick={handleModal}
        selected={mode === FullResultModeEnum.MODAL}
        title={t('Open in modal')}
      >
        <Modal />
      </SelectToggleButton>
      <SelectToggleButton
        onlyIcon
        onClick={handleSidebar}
        selected={mode === FullResultModeEnum.SIDEBAR}
        title={t('Open in sidebar')}
      >
        <Sidebar />
      </SelectToggleButton>
    </div>
  );
};

export default memo(ModeToggle);
