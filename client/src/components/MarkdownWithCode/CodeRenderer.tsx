import {
  Dispatch,
  memo,
  MutableRefObject,
  ReactNode,
  SetStateAction,
  useCallback,
  useMemo,
} from 'react';
import FileChip from '../Chat/ConversationMessage/FileChip';
import CodeWithBreadcrumbs from '../../pages/RepoTab/ArticleResponse/CodeWithBreadcrumbs';
import { FileHighlightsType } from '../../types/general';
import NewCode from './NewCode';

type Props = {
  children: ReactNode[];
  repoName: string;
  fileChips: MutableRefObject<never[]>;
  hideCode?: boolean;
  updateScrollToIndex: (lines: string) => void;
  setFileHighlights: Dispatch<SetStateAction<FileHighlightsType>>;
  setHoveredLines: Dispatch<SetStateAction<[number, number] | null>>;
  className?: string;
  propsJSON: string;
  inline?: boolean;
  navigateFullResult: (
    path: string,
    pathParams?: Record<string, string>,
    recordId?: number,
    threadId?: string,
  ) => void;
  recordId: number;
  threadId: string;
};

const CodeRenderer = ({
  className,
  children,
  inline,
  hideCode,
  updateScrollToIndex,
  fileChips,
  setFileHighlights,
  setHoveredLines,
  repoName,
  propsJSON,
  navigateFullResult,
  recordId,
  threadId,
}: Props) => {
  const matchLang = useMemo(
    () =>
      /lang:(\w+)/.exec(className || '') ||
      /language-(\w+)/.exec(className || ''),
    [className],
  );
  const matchType = useMemo(
    () => /language-type:(\w+)/.exec(className || ''),
    [className],
  );
  const matchPath = useMemo(
    () => /path:(.+),/.exec(className || ''),
    [className],
  );
  const matchLines = useMemo(
    () => /lines:(.+)/.exec(className || ''),
    [className],
  );
  const code = useMemo(
    () =>
      typeof children[0] === 'string' ? children[0].replace(/\n$/, '') : '',
    [children],
  );
  const lines = useMemo(
    () => matchLines?.[1].split('-').map((l) => Number(l)) || [],
    [matchLines],
  );
  const colorPreview = useMemo(
    () =>
      children[0] &&
      children.length === 1 &&
      typeof children[0] === 'string' &&
      /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(children[0]) ? (
        <span
          className="w-3 h-3 inline-block"
          style={{ backgroundColor: children[0] }}
        />
      ) : null,
    [children],
  );

  const linesToUse: [number, number] | undefined = useMemo(
    () => [lines[0], lines[1] ?? lines[0]],
    [lines],
  );

  const handleChipClick = useCallback(() => {
    updateScrollToIndex(`${lines[0]}_${lines[1] ?? lines[0]}`);
  }, [updateScrollToIndex, lines]);

  return (
    <>
      {!inline &&
      (matchType?.[1] || matchLang?.[1]) &&
      typeof children[0] === 'string' ? (
        matchType?.[1] === 'Quoted' ? (
          hideCode ? (
            <FileChip
              fileName={matchPath?.[1] || ''}
              filePath={matchPath?.[1] || ''}
              skipIcon={false}
              onClick={handleChipClick}
              lines={linesToUse}
              fileChips={fileChips}
              setFileHighlights={setFileHighlights}
              setHoveredLines={setHoveredLines}
            />
          ) : (
            <CodeWithBreadcrumbs
              code={code}
              language={matchLang?.[1] || ''}
              filePath={matchPath?.[1] || ''}
              onResultClick={(path, lines) => {
                navigateFullResult(
                  path,
                  lines ? { scrollToLine: lines } : undefined,
                  recordId,
                  threadId,
                );
              }}
              startLine={lines[0] ? lines[0] : null}
              repoName={repoName}
            />
          )
        ) : (
          <NewCode code={code} language={matchLang?.[1] || ''} />
        )
      ) : colorPreview ? (
        <span className="inline-flex gap-1.5 items-center">
          {colorPreview}
          <code {...JSON.parse(propsJSON)} className={className}>
            {children}
          </code>
        </span>
      ) : (
        <code {...JSON.parse(propsJSON)} className={className}>
          {children}
        </code>
      )}
    </>
  );
};

export default memo(CodeRenderer);
