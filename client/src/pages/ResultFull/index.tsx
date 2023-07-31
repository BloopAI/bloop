import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import { useTranslation } from 'react-i18next';
import FileIcon from '../../components/FileIcon';
import Breadcrumbs from '../../components/Breadcrumbs';
import CodeFull from '../../components/CodeBlock/CodeFull';
import { getConversation, getHoverables } from '../../services/api';
import { mapFileResult, mapRanges } from '../../mappers/results';
import { FullResult } from '../../types/results';
import {
  breadcrumbsItemPath,
  humanFileSize,
  isWindowsPath,
  splitPathForBreadcrumbs,
} from '../../utils';
import ErrorFallback from '../../components/ErrorFallback';
import useAppNavigation from '../../hooks/useAppNavigation';
import FileMenu from '../../components/FileMenu';
import SkeletonItem from '../../components/SkeletonItem';
import IpynbRenderer from '../../components/IpynbRenderer';
import { ChatContext } from '../../context/chatContext';
import { conversationsCache } from '../../services/cache';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
  ChatMessageType,
} from '../../types/general';
import { mapLoadingSteps } from '../../mappers/conversation';
import FileExplanation from './FileExplanation';

type Props = {
  data: any;
  isLoading: boolean;
  repoName: string;
  selectedBranch: string | null;
  recordId: number;
  threadId: string;
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
  recordId,
  threadId,
}: Props) => {
  const { t } = useTranslation();
  const { navigateFullResult, navigateRepoPath } = useAppNavigation();
  const [result, setResult] = useState<FullResult | null>(null);
  const { conversation, setConversation, setThreadId } =
    useContext(ChatContext);
  const answer = useMemo(
    () => conversationsCache[threadId]?.[recordId] || conversation[recordId],
    [
      (conversation[recordId] as ChatMessageServer)?.results,
      (conversation[recordId] as ChatMessageServer)?.isLoading,
      recordId,
      threadId,
    ],
  );

  useEffect(() => {
    if (
      threadId &&
      !conversationsCache[threadId]?.[recordId] &&
      !conversation[recordId]
    ) {
      getConversation(threadId).then((resp) => {
        const conv: ChatMessage[] = [];
        resp.forEach((m) => {
          const userQuery = m.search_steps.find((s) => s.type === 'QUERY');
          if (userQuery) {
            conv.push({
              author: ChatMessageAuthor.User,
              text: userQuery.content,
              isFromHistory: true,
            });
          }
          conv.push({
            author: ChatMessageAuthor.Server,
            isLoading: false,
            type: ChatMessageType.Answer,
            loadingSteps: mapLoadingSteps(m.search_steps, t),
            text: m.conclusion,
            results: m.outcome,
            isFromHistory: true,
          });
        });
        conversationsCache[threadId] = conv;
        setThreadId(threadId);
        setConversation(conv);
      });
    }
  }, []);

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
        navigateFullResult(result.repoName, path);
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

  return (
    <>
      <div className="flex-1 overflow-auto w-full box-content flex flex-col">
        <div className="w-full flex flex-col overflow-auto flex-1">
          <div
            className={`w-full border-b border-bg-border flex justify-between py-3 px-8`}
          >
            <div className="flex items-center gap-1 overflow-hidden w-full">
              <FileIcon filename={result?.relativePath?.slice(-5) || ''} />
              {!!result && !!breadcrumbs.length ? (
                <div className="flex-1">
                  <Breadcrumbs
                    pathParts={breadcrumbs}
                    activeStyle="secondary"
                    path={result.relativePath || ''}
                  />
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
            <div className={`flex py-3 px-8 h-full`}>
              {!result ? (
                <div className="w-full h-full flex flex-col gap-3">
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
              ) : (
                <CodeFull
                  code={result.code}
                  language={result.language}
                  repoPath={result.repoPath}
                  relativePath={result.relativePath}
                  metadata={{
                    hoverableRanges: result.hoverableRanges,
                    lexicalBlocks: [],
                  }}
                  scrollElement={null}
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
              )}
            </div>
          </div>
        </div>
      </div>
      {!!answer && (
        <FileExplanation
          markdown={answer.results.Article}
          repoName={result?.repoName || ''}
        />
      )}
    </>
  );
};

export default Sentry.withErrorBoundary(ResultFull, {
  fallback: (props) => <ErrorFallback {...props} />,
});
