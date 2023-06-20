import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';
import FileIcon from '../../components/FileIcon';
import Breadcrumbs from '../../components/Breadcrumbs';
import IdeNavigation from '../../components/IdeNavigation';
import CodeFull from '../../components/CodeBlock/CodeFull';
import { getHoverables } from '../../services/api';
import { mapFileResult, mapRanges } from '../../mappers/results';
import ShareFileModal from '../../components/ShareFileModal';
import { FullResult } from '../../types/results';
import {
  breadcrumbsItemPath,
  isWindowsPath,
  splitPathForBreadcrumbs,
} from '../../utils';
import ErrorFallback from '../../components/ErrorFallback';
import useAppNavigation from '../../hooks/useAppNavigation';
import { FileTreeFileType } from '../../types';
import { getFileName } from '../../utils/file';
import FileMenu from '../../components/FileMenu';
import SkeletonItem from '../../components/SkeletonItem';

type Props = {
  data: any;
  isLoading: boolean;
};

const SIDEBAR_WIDTH = 324;
const HEADER_HEIGHT = 64;
const FOOTER_HEIGHT = 64;
const HORIZONTAL_PADDINGS = 64;
const VERTICAL_PADDINGS = 32;
const BREADCRUMBS_HEIGHT = 47;

const ResultFull = ({ data, isLoading }: Props) => {
  // const [activeTab, setActiveTab] = useState(0);
  // const [scrollableElement, setScrollableElement] =
  //   useState<HTMLDivElement | null>(null);

  const [isShareOpen, setShareOpen] = useState(false);
  const { navigateFullResult, navigateRepoPath } = useAppNavigation();
  const [result, setResult] = useState<FullResult | null>(null);

  useEffect(() => {
    if (!data || data?.data?.[0]?.kind !== 'file') {
      return;
    }

    const item = data.data[0];
    const mappedResult = mapFileResult({
      ...item,
      data: {
        ...item.data,
        siblings: [
          ...item.data.siblings,
          {
            name: getFileName(item.data.relative_path),
            entry_data: {
              File: {
                lang: item.data.lang,
              },
            },
            currentFile: true,
          },
        ],
      },
    });
    setResult(mappedResult);
    getHoverables(item.data.relative_path, item.data.repo_ref).then((data) => {
      setResult((prevState) => ({
        ...prevState!,
        hoverableRanges: mapRanges(data.ranges),
      }));
    });
  }, [data, isLoading]);

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

  // const scrollRef = useRef<HTMLDivElement>(null);
  //
  // useEffect(() => {
  //   setScrollableElement(scrollRef.current);
  // });

  return (
    <>
      <IdeNavigation
        repoName={result?.repoName || ''}
        files={result?.fileTree || []}
        branches={[]}
        versions={[]}
        initialBranch={0}
        initialVersion={0}
        currentPath={currentPath}
        onFileClick={(p, type) => {
          navigateTo(p, type === FileTreeFileType.FILE);
        }}
      />
      <div className="flex-1 overflow-auto w-full box-content flex flex-col">
        <div className="w-full flex flex-col overflow-auto flex-1">
          <div
            className={`w-full border-b border-bg-border flex justify-between py-3 px-8`}
          >
            <div className="flex items-center gap-1 overflow-hidden">
              <FileIcon filename={result?.relativePath?.slice(-5) || ''} />
              {!!result && !!breadcrumbs.length ? (
                <Breadcrumbs
                  pathParts={breadcrumbs}
                  activeStyle="secondary"
                  path={result.relativePath || ''}
                />
              ) : (
                <div className="w-48 h-4">
                  <SkeletonItem />
                </div>
              )}
            </div>
            {/*<div className="flex gap-2">*/}
            {/*<SelectToggleButton onlyIcon title="Star">*/}
            {/*  <Star />*/}
            {/*</SelectToggleButton>*/}
            {/*<Button variant="primary" onClick={() => setShareOpen(true)}>*/}
            {/*  Share*/}
            {/*  <ArrowBoxOut />*/}
            {/*</Button>*/}
            {/*</div>*/}
            <FileMenu
              relativePath={result?.relativePath || ''}
              repoPath={result?.repoPath || ''}
            />
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
      <ShareFileModal
        isOpen={isShareOpen}
        onClose={() => setShareOpen(false)}
        result={result}
        filePath={result?.relativePath || ''}
        breadcrumbs={breadcrumbs}
      />
    </>
  );
};

export default Sentry.withErrorBoundary(ResultFull, {
  fallback: (props) => <ErrorFallback {...props} />,
});
