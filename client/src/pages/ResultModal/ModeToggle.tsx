import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import SelectToggleButton from '../../components/SelectToggleButton';
import { ChevronDoubleIntersected, Modal, Sidebar } from '../../icons';
import { FullResultModeEnum } from '../../types/general';
import useAppNavigation from '../../hooks/useAppNavigation';

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

  const handleFull = useCallback(() => {
    navigateFullResult(repoName, relativePath, {
      scroll_line_index: searchParams.get('scroll_line_index') || '',
    });
  }, [searchParams, repoName, relativePath]);

  const handleModal = useCallback(() => {
    setModeAndTransition(FullResultModeEnum.MODAL);
  }, []);

  const handleSidebar = useCallback(() => {
    setModeAndTransition(FullResultModeEnum.SIDEBAR);
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
