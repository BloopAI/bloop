import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FullResult } from '../../types/results';
import { useSearch } from '../../hooks/useSearch';
import { FileSearchResponse } from '../../types/api';
import { FullResultModeEnum } from '../../types/general';
import { mapFileResult, mapRanges } from '../../mappers/results';
import { getHoverables } from '../../services/api';
import { buildRepoQuery } from '../../utils';
import ResultModal from './index';

type Props = {
  repoName: string;
  path: string;
  isOpen: boolean;
  onClose: () => void;
  scrollToLine?: string;
};

const FileModalContainer = ({
  repoName,
  path,
  isOpen,
  onClose,
  scrollToLine,
}: Props) => {
  const [mode, setMode] = useState<FullResultModeEnum>(
    FullResultModeEnum.MODAL,
  );
  const [openResult, setOpenResult] = useState<FullResult | null>(null);
  const { searchQuery: fileModalSearchQuery, data: fileResultData } =
    useSearch<FileSearchResponse>();
  const navigateBrowser = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fileModalSearchQuery(buildRepoQuery(repoName, path));
    }
  }, [repoName, path, isOpen]);

  useEffect(() => {
    if (fileResultData?.data?.length) {
      setOpenResult(mapFileResult(fileResultData.data[0]));
      navigateBrowser({
        search: scrollToLine
          ? '?' +
            new URLSearchParams({
              scroll_line_index: scrollToLine.toString(),
            }).toString()
          : '',
      });
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

  const onResultClosed = useCallback(() => {
    setOpenResult(null);
    onClose();
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
