import React, { useCallback, useContext, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import SelectToggleButton from '../../components/SelectToggleButton';
import { ChevronDoubleIntersected, Modal, Sidebar } from '../../icons';
import { FullResultModeEnum } from '../../types/general';
import useAppNavigation from '../../hooks/useAppNavigation';
import { FileModalContext } from '../../context/fileModalContext';

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
  const [searchParams] = useSearchParams();
  const { navigateFullResult } = useAppNavigation();
  const [isPending, startTransition] = useTransition();
  const { setIsFileModalOpen } = useContext(FileModalContext);

  const handleFull = useCallback(() => {
    setIsFileModalOpen(false);
    navigateFullResult(repoName, relativePath, {
      scrollToLine: searchParams.get('modalScrollToLine') || '',
    });
  }, [searchParams, repoName, relativePath]);

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
        title="Open in full view"
      >
        <ChevronDoubleIntersected />
      </SelectToggleButton>
      <SelectToggleButton
        onlyIcon
        onClick={handleModal}
        selected={mode === FullResultModeEnum.MODAL}
        title="Open in modal"
      >
        <Modal />
      </SelectToggleButton>
      <SelectToggleButton
        onlyIcon
        onClick={handleSidebar}
        selected={mode === FullResultModeEnum.SIDEBAR}
        title="Open in sidebar"
      >
        <Sidebar />
      </SelectToggleButton>
    </div>
  );
};

export default ModeToggle;
