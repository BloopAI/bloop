import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FullResult } from '../../types/results';
import { useSearch } from '../../hooks/useSearch';
import { FileSearchResponse } from '../../types/api';
import { FullResultModeEnum } from '../../types/general';
import { mapFileResult, mapRanges } from '../../mappers/results';
import { getHoverables } from '../../services/api';
import { buildRepoQuery } from '../../utils';
import { FileModalContext } from '../../context/fileModalContext';
import { AppNavigationContext } from '../../context/appNavigationContext';
import ResultModal from './index';

type Props = {
  repoName: string;
};

const FileModalContainer = ({ repoName }: Props) => {
  const { path, setIsFileModalOpen, isFileModalOpen } =
    useContext(FileModalContext);
  const { navigatedItem } = useContext(AppNavigationContext);
  const [mode, setMode] = useState<FullResultModeEnum>(
    FullResultModeEnum.MODAL,
  );
  const [openResult, setOpenResult] = useState<FullResult | null>(null);
  const { searchQuery: fileModalSearchQuery, data: fileResultData } =
    useSearch<FileSearchResponse>();

  useEffect(() => {
    if (isFileModalOpen) {
      fileModalSearchQuery(buildRepoQuery(repoName, path));
    }
  }, [repoName, path, isFileModalOpen]);

  useEffect(() => {
    setMode(
      navigatedItem?.type === 'search'
        ? FullResultModeEnum.SIDEBAR
        : FullResultModeEnum.MODAL,
    );
  }, [navigatedItem?.type]);

  useEffect(() => {
    if (fileResultData?.data?.length) {
      setOpenResult(mapFileResult(fileResultData.data[0]));
      getHoverables(
        fileResultData.data[0].data.relative_path,
        fileResultData.data[0].data.repo_ref,
      ).then((data) => {
        setOpenResult((prevState) => ({
          ...prevState!,
          hoverableRanges: mapRanges(data.ranges),
        }));
      });
    }
  }, [fileResultData]);

  const handleModeChange = useCallback((m: FullResultModeEnum) => {
    setMode(m);
  }, []);

  useEffect(() => {
    if (!isFileModalOpen) {
      setOpenResult(null);
    }
  }, [isFileModalOpen]);

  const onResultClosed = useCallback(() => {
    setIsFileModalOpen(false);
  }, [mode]);

  return (
    <ResultModal
      result={openResult}
      onResultClosed={onResultClosed}
      mode={mode}
      setMode={handleModeChange}
    />
  );
};

export default FileModalContainer;
