import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';
import FileIcon from '../../components/FileIcon';
import Breadcrumbs from '../../components/Breadcrumbs';
// import Tabs from '../../components/Tabs';
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
import Skeleton from '../../components/Skeleton';
import useAppNavigation from '../../hooks/useAppNavigation';
import { FileTreeFileType } from '../../types';
import { getFileName } from '../../utils/file';
import FileMenu from '../../components/FileMenu';

type Props = {
  data: any;
};

const SIDEBAR_WIDTH = 324;
const HEADER_HEIGHT = 64;
const FOOTER_HEIGHT = 64;
const HORIZONTAL_PADDINGS = 64;
const VERTICAL_PADDINGS = 32;
const BREADCRUMBS_HEIGHT = 47;

const ResultFull = ({ data }: Props) => {
  // const [activeTab, setActiveTab] = useState(0);
  // const [scrollableElement, setScrollableElement] =
  //   useState<HTMLDivElement | null>(null);

  const [isShareOpen, setShareOpen] = useState(false);
  const { navigateFullResult, navigateRepoPath } = useAppNavigation();
  const [result, setResult] = useState<FullResult | null>(null);

  useEffect(() => {
    if (!data) {
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
  }, [data]);

  const navigateTo = useCallback(
    (path: string, isFile: boolean) => {
      if (!result) {
        return;
      }
      if (isFile) {
        navigateFullResult(result.repoName, path);
      } else {
        navigateRepoPath(result.repoName, path);
      }
    },
    [result],
  );

  const breadcrumbs = useMemo(() => {
    if (!result) {
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
  }, [result?.relativePath]);

  const currentPath = useMemo(() => {
    const pathParts = result?.relativePath.split('/') || [];
    return pathParts.length > 1 ? pathParts.slice(0, -1).join('/') + '/' : '';
  }, [result]);

  // const scrollRef = useRef<HTMLDivElement>(null);
  //
  // useEffect(() => {
  //   setScrollableElement(scrollRef.current);
  // });

  return !result ? (
    <Skeleton />
  ) : (
    <>
      <IdeNavigation
        repoName={result.repoName}
        files={result.fileTree || []}
        branches={[]}
        versions={[]}
        initialBranch={0}
        initialVersion={0}
        currentPath={currentPath}
        onFileClick={(p, type) => {
          navigateTo(p, type === FileTreeFileType.FILE);
        }}
      />
      {!!result && (
        <div className="flex-1 overflow-auto w-full box-content flex flex-col">
          <div className="w-full flex flex-col overflow-auto flex-1">
            <div
              className={`w-full border-b border-gray-700 flex justify-between py-3 px-8 select-none`}
            >
              <div className="flex items-center gap-1 overflow-hidden">
                <FileIcon filename={result.relativePath.slice(-5)} />
                <Breadcrumbs
                  pathParts={breadcrumbs}
                  activeStyle="secondary"
                  path={result.relativePath}
                />
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
                relativePath={result.relativePath}
                repoPath={result.repoPath}
              />
            </div>
            <div className="overflow-scroll flex-1">
              {/*<div*/}
              {/*  className={`border-b border-gray-700 w-full pb-0 py-3 px-8`}*/}
              {/*>*/}
              {/*  <Tabs*/}
              {/*    activeTab={activeTab}*/}
              {/*    onTabChange={setActiveTab}*/}
              {/*    tabs={tabs}*/}
              {/*  />*/}
              {/*</div>*/}
              {/*{activeTab === 0 ? (*/}
              <div className={`flex px-2 py-4 bg-gray-900 py-3 px-8 h-full`}>
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
              </div>
            </div>
          </div>
        </div>
      )}
      <ShareFileModal
        isOpen={isShareOpen}
        onClose={() => setShareOpen(false)}
        result={result}
        filePath={result.relativePath}
        breadcrumbs={breadcrumbs}
      />
    </>
  );
};

export default Sentry.withErrorBoundary(ResultFull, {
  fallback: (props) => <ErrorFallback {...props} />,
});
