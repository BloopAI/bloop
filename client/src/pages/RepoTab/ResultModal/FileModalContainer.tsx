import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { FullResult } from '../../../types/results';
import { useSearch } from '../../../hooks/useSearch';
import { FileSearchResponse } from '../../../types/api';
import { FullResultModeEnum } from '../../../types/general';
import { mapFileResult, mapRanges } from '../../../mappers/results';
import { getHoverables } from '../../../services/api';
import { buildRepoQuery } from '../../../utils';
import { SearchContext } from '../../../context/searchContext';
import { FileModalContext } from '../../../context/fileModalContext';
import { AppNavigationContext } from '../../../context/appNavigationContext';
import { UIContext } from '../../../context/uiContext';
import ResultModal from './index';

type Props = {
  repoName: string;
};

const FileModalContainer = ({ repoName }: Props) => {
  const { path, closeFileModalOpen, isFileModalOpen } =
    useContext(FileModalContext);
  const { navigatedItem } = useContext(AppNavigationContext);
  const [mode, setMode] = useState<FullResultModeEnum>(
    FullResultModeEnum.MODAL,
  );
  const [openResult, setOpenResult] = useState<FullResult | null>(null);
  const { searchQuery: fileModalSearchQuery, data: fileResultData } =
    useSearch<FileSearchResponse>();
  const { selectedBranch } = useContext(SearchContext.SelectedBranch);
  const { setFiltersOpen } = useContext(UIContext.Filters);

  useEffect(() => {
    if (isFileModalOpen) {
      fileModalSearchQuery(buildRepoQuery(repoName, path, selectedBranch));
    }
  }, [repoName, path, isFileModalOpen, selectedBranch]);

  useEffect(() => {
    setMode(
      navigatedItem?.type === 'search'
        ? FullResultModeEnum.SIDEBAR
        : FullResultModeEnum.MODAL,
    );
  }, [navigatedItem?.type]);

  useEffect(() => {
    if (fileResultData?.data?.length && isFileModalOpen) {
      setOpenResult(mapFileResult(fileResultData.data[0]));
      getHoverables(
        fileResultData.data[0].data.relative_path,
        fileResultData.data[0].data.repo_ref,
        selectedBranch ? selectedBranch : undefined,
      ).then((data) => {
        setOpenResult((prevState) => ({
          ...prevState!,
          hoverableRanges: mapRanges(data.ranges),
        }));
      });
    }
  }, [fileResultData, selectedBranch, isFileModalOpen]);

  const handleModeChange = useCallback((m: FullResultModeEnum) => {
    setMode(m);
  }, []);

  useEffect(() => {
    if (!isFileModalOpen) {
      setOpenResult(null);
    }
  }, [isFileModalOpen]);

  useEffect(() => {
    if (isFileModalOpen && mode === FullResultModeEnum.SIDEBAR) {
      setFiltersOpen(false);
    }
  }, [isFileModalOpen, mode]);

  const onResultClosed = useCallback(() => {
    closeFileModalOpen();
    setFiltersOpen(true);
  }, [closeFileModalOpen]);

  return (
    <ResultModal
      result={openResult?.relativePath === path ? openResult : null}
      onResultClosed={onResultClosed}
      mode={mode}
      setMode={handleModeChange}
    />
  );
};

export default memo(FileModalContainer);
