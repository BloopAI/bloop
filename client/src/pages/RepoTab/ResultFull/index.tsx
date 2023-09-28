import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import { Trans, useTranslation } from 'react-i18next';
import FileIcon from '../../../components/FileIcon';
import CodeFull from '../../../components/CodeBlock/CodeFull';
import { forceFileToBeIndexed, getHoverables } from '../../../services/api';
import { mapFileResult, mapRanges } from '../../../mappers/results';
import { FullResult } from '../../../types/results';
import {
  breadcrumbsItemPath,
  humanFileSize,
  isWindowsPath,
  splitPath,
  splitPathForBreadcrumbs,
} from '../../../utils';
import ErrorFallback from '../../../components/ErrorFallback';
import useAppNavigation from '../../../hooks/useAppNavigation';
import FileMenu from '../../../components/FileMenu';
import SkeletonItem from '../../../components/SkeletonItem';
import IpynbRenderer from '../../../components/IpynbRenderer';
import Button from '../../../components/Button';
import { Sparkles } from '../../../icons';
import { ChatContext } from '../../../context/chatContext';
import { UIContext } from '../../../context/uiContext';
import AddStudioContext from '../../../components/AddStudioContext';
import { SyncStatus } from '../../../types/general';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import LiteLoaderContainer from '../../../components/Loaders/LiteLoader';
import { DeviceContext } from '../../../context/deviceContext';

type Props = {
  data: any;
  isLoading: boolean;
  repoName: string;
  selectedBranch: string | null;
  recordId: number;
  threadId: string;
  path?: string;
  refetchFile: () => void;
};

const SIDEBAR_WIDTH = 324;
const HEADER_HEIGHT = 64;
const FOOTER_HEIGHT = 64;
const HORIZONTAL_PADDINGS = 64;
const VERTICAL_PADDINGS = 32;
const BREADCRUMBS_HEIGHT = 47;

const ResultFull = ({
  data,
  isLoading,
  selectedBranch,
  refetchFile,
  path,
}: Props) => {
  useTranslation();
  const { navigateFullResult, navigateRepoPath } = useAppNavigation();
  const [result, setResult] = useState<FullResult | null>(null);
  const {
    setSubmittedQuery,
    setChatOpen,
    setConversation,
    setThreadId,
    setIsHistoryTab,
  } = useContext(ChatContext.Setters);
  const { repositories } = useContext(RepositoriesContext);
  const { tab } = useContext(UIContext.Tab);
  const { isSelfServe } = useContext(DeviceContext);
  const [indexRequested, setIndexRequested] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  const repoStatus = useMemo(() => {
    return (
      repositories?.find((r) => r.ref === tab.repoRef)?.sync_status ||
      SyncStatus.Done
    );
  }, [repositories, tab.repoRef]);

  useEffect(() => {
    if (
      [
        SyncStatus.Indexing,
        SyncStatus.Queued,
        SyncStatus.Syncing,
        SyncStatus.Indexing,
      ].includes(repoStatus) &&
      indexRequested
    ) {
      setIsIndexing(true);
    } else {
      if (isIndexing) {
        setTimeout(() => {
          refetchFile();
          setIsIndexing(false);
          setIndexRequested(false);
        }, 500);
      }
    }
  }, [repoStatus, isIndexing, refetchFile]);

  const onIndexRequested = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data?.data?.[0]?.data?.relative_path) {
        forceFileToBeIndexed(tab.repoRef, data?.data?.[0]?.data?.relative_path);
        setIndexRequested(true);
        setTimeout(() => refetchFile(), 1000);
      }
    },
    [tab.repoRef, data?.data?.[0]?.data?.relative_path],
  );

  useEffect(() => {
    setIndexRequested(false);
  }, [path]);

  useEffect(() => {
    if (!data || data?.data?.[0]?.kind !== 'file') {
      return;
    }

    const item = data.data[0];
    const mappedResult = mapFileResult(item);
    setResult(mappedResult);
    getHoverables(
      item.data.relative_path,
      item.data.repo_ref,
      selectedBranch ? selectedBranch : undefined,
    ).then((data) => {
      setResult((prevState) => ({
        ...prevState!,
        hoverableRanges: mapRanges(data.ranges),
      }));
    });
  }, [data, isLoading, selectedBranch]);

  const navigateTo = useCallback(
    (path: string, isFile: boolean) => {
      if (!result || isLoading) {
        return;
      }
      if (isFile) {
        navigateFullResult(path);
      } else {
        navigateRepoPath(result.repoName, path);
      }
    },
    [result, isLoading],
  );

  const breadcrumbs = useMemo(() => {
    if (!result || isLoading) {
      return [];
    }
    return splitPathForBreadcrumbs(
      result.relativePath,
      (e, item, index, pathParts) => {
        const isFile = index === pathParts.length - 1;
        const path = breadcrumbsItemPath(
          pathParts,
          index,
          isWindowsPath(currentPath),
          isFile,
        );

        navigateTo(isFile ? path : `${path}`, isFile);
      },
    );
  }, [result?.relativePath, isLoading]);

  const currentPath = useMemo(() => {
    const pathParts = result?.relativePath?.split('/') || [];
    return pathParts.length > 1 ? pathParts.slice(0, -1).join('/') + '/' : '';
  }, [result]);

  const handleExplain = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.stopPropagation();
      if (!result) {
        return;
      }
      setConversation([]);
      setThreadId('');
      const endLine = result.code.split(/\n(?!$)/g).length - 1;
      setIsHistoryTab(false);
      setSubmittedQuery(
        `#explain_${result.relativePath}:0-${endLine}-${Date.now()}`,
      );
      setChatOpen(true);
    },
    [result?.code, result?.relativePath],
  );
  const metadata = useMemo(() => {
    return {
      hoverableRanges: result?.hoverableRanges || [],
      lexicalBlocks: [],
    };
  }, [result?.hoverableRanges]);

  return (
    <>
      <div className="flex-1 overflow-auto w-full box-content flex flex-col">
        <div className="w-full flex flex-col overflow-auto flex-1">
          <div
            className={`w-full border-b border-bg-border flex justify-between px-3 h-12 flex-shrink-0 bg-bg-base`}
          >
            <div className="flex items-center gap-1 overflow-hidden w-full">
              <FileIcon filename={result?.relativePath?.slice(-5) || ''} />
              {!!result && !!breadcrumbs.length ? (
                <div className="flex-1 body-s-strong ellipsis">
                  {splitPath(result.relativePath || '')?.pop()}
                </div>
              ) : (
                <div className="w-48 h-4">
                  <SkeletonItem />
                </div>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <p className="code-s flex-shrink-0 text-label-base">
                {result?.code.split('\n').length} lines ({result?.loc} loc) ·{' '}
                {result?.size ? humanFileSize(result?.size) : ''}
              </p>
              <Button size="tiny" onClick={handleExplain}>
                <Sparkles raw sizeClassName="w-3.5 h-3.5" />
                <Trans>Explain</Trans>
              </Button>
              {!!result && <AddStudioContext filePath={result.relativePath} />}
              <FileMenu
                relativePath={result?.relativePath || ''}
                repoPath={result?.repoPath || ''}
              />
            </div>
          </div>
          <div
            className="overflow-scroll flex-1"
            id="result-full-code-container"
          >
            <div className={`flex py-3 pl-2 h-full`}>
              {!result ? (
                <div className="w-full h-full flex flex-col gap-3 pl-4">
                  <div className="h-4 w-48">
                    <SkeletonItem />
                  </div>
                  <div className="h-4 w-96">
                    <SkeletonItem />
                  </div>
                  <div className="h-4 w-56">
                    <SkeletonItem />
                  </div>
                  <div className="h-4 w-80">
                    <SkeletonItem />
                  </div>
                  <div className="h-4 w-48">
                    <SkeletonItem />
                  </div>
                  <div className="h-4 w-96">
                    <SkeletonItem />
                  </div>
                  <div className="h-4 w-56">
                    <SkeletonItem />
                  </div>
                  <div className="h-4 w-80">
                    <SkeletonItem />
                  </div>
                </div>
              ) : result.language === 'jupyter notebook' ? (
                <IpynbRenderer data={result.code} />
              ) : result?.indexed ? (
                <CodeFull
                  code={result.code}
                  language={result.language}
                  repoPath={result.repoPath}
                  relativePath={result.relativePath}
                  metadata={metadata}
                  containerWidth={
                    window.innerWidth - SIDEBAR_WIDTH - HORIZONTAL_PADDINGS
                  }
                  containerHeight={
                    window.innerHeight -
                    HEADER_HEIGHT -
                    FOOTER_HEIGHT -
                    VERTICAL_PADDINGS -
                    BREADCRUMBS_HEIGHT
                  }
                  repoName={result.repoName}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex flex-col gap-3 max-w-sm items-center">
                    <p className="text-label-title body-m-strong">
                      <Trans>File not indexed</Trans>
                    </p>
                    <p className="text-label-base text-center body-s">
                      <Trans>
                        bloop automatically excludes certain files from the
                        indexing. This file might be too big or it might have an
                        excluded file type.
                      </Trans>
                    </p>
                    {!indexRequested && isSelfServe ? (
                      <Button
                        variant="secondary"
                        className="mt-6"
                        onClick={onIndexRequested}
                      >
                        <Trans>Force index</Trans>
                      </Button>
                    ) : indexRequested ? (
                      <div className="text-bg-main mt-6">
                        <LiteLoaderContainer sizeClassName="w-8 h-8" />
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sentry.withErrorBoundary(ResultFull, {
  fallback: (props) => <ErrorFallback {...props} />,
});
