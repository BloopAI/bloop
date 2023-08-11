import {
  Dispatch,
  memo,
  MutableRefObject,
  ReactElement,
  ReactNode,
  SetStateAction,
  useCallback,
  useMemo,
} from 'react';
import FileChip from '../Chat/ConversationMessage/FileChip';
import { FileHighlightsType } from '../../types/general';
import FolderChip from './FolderChip';

type Props = {
  href?: string;
  children: ReactNode[];
  navigateRepoPath: (repo: string, path?: string | undefined) => void;
  navigateFullResult: (
    path: string,
    pathParams?: Record<string, string> | undefined,
    messageIndex?: number | undefined,
    searchId?: string | undefined,
  ) => void;
  repoName: string;
  selectedBranch: string | null;
  isSummary?: boolean;
  fileChips: MutableRefObject<never[]>;
  hideCode?: boolean;
  updateScrollToIndex: (lines: string) => void;
  openFileModal: (
    path: string,
    scrollToLine?: string | undefined,
    highlightColor?: string | undefined,
  ) => void;
  setFileHighlights: Dispatch<SetStateAction<FileHighlightsType>>;
  setHoveredLines: Dispatch<SetStateAction<[number, number] | null>>;
};

const LinkRenderer = ({
  href,
  children,
  navigateRepoPath,
  navigateFullResult,
  repoName,
  selectedBranch,
  isSummary,
  fileChips,
  hideCode,
  updateScrollToIndex,
  openFileModal,
  setFileHighlights,
  setHoveredLines,
}: Props) => {
  const [filePath, lines] = useMemo(() => href?.split('#') || [], [href]);
  const [start, end] = useMemo(
    () => lines?.split('-').map((l) => Number(l.slice(1))) || [],
    [lines],
  );
  const fileName = useMemo(() => {
    let f: string = '';
    if (children?.[0]) {
      if (typeof children[0] === 'string') {
        f = children?.[0];
      }
      const child = children[0] as ReactElement;
      if (child?.props && typeof child.props.children?.[0] === 'string') {
        f = child.props.children?.[0];
      }
    }
    return f;
  }, [children]);

  const linesToUse: [number, number] | undefined = useMemo(() => {
    return hideCode && start ? [start - 1, (end ?? start) - 1] : undefined;
  }, [hideCode, start, end]);

  const handleClickFile = useCallback(() => {
    hideCode
      ? updateScrollToIndex(`${start - 1}_${(end ?? start) - 1}`)
      : openFileModal(
          filePath,
          start ? `${start - 1}_${(end ?? start) - 1}` : undefined,
        );
  }, [hideCode, updateScrollToIndex, start, end, filePath]);

  const handleClickFolder = useCallback(() => {
    navigateRepoPath(repoName, filePath);
  }, [navigateRepoPath, repoName, filePath]);

  return (
    <>
      {filePath.endsWith('/') ? (
        <FolderChip
          onClick={handleClickFolder}
          path={filePath}
          navigateFullResult={navigateFullResult}
          repoName={repoName}
          selectedBranch={selectedBranch}
          isSummary={isSummary}
        />
      ) : (
        <FileChip
          fileName={fileName || filePath || ''}
          filePath={filePath}
          skipIcon={!!fileName && fileName !== filePath}
          fileChips={fileChips}
          onClick={handleClickFile}
          lines={linesToUse}
          setFileHighlights={setFileHighlights}
          setHoveredLines={setHoveredLines}
        />
      )}
    </>
  );
};

export default memo(LinkRenderer);
