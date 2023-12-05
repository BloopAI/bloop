import {
  Dispatch,
  memo,
  MutableRefObject,
  ReactElement,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { FileHighlightsType, TabTypesEnum } from '../../types/general';
import { TabsContext } from '../../context/tabsContext';
import FileChip from '../Chips/FileChip';
import FolderChip from './FolderChip';

type Props = {
  href?: string;
  children: ReactNode[];
  fileChips: MutableRefObject<never[]>;
  hideCode?: boolean;
  setFileHighlights: Dispatch<SetStateAction<FileHighlightsType>>;
  setHoveredLines: Dispatch<SetStateAction<[number, number] | null>>;
  recordId?: number;
  threadId?: string;
  side: 'left' | 'right';
};

const LinkRenderer = ({
  href,
  children,
  fileChips,
  hideCode,
  setFileHighlights,
  setHoveredLines,
  recordId,
  threadId,
  side,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const [filePath, lines] = useMemo(() => href?.split('#') || [], [href]);
  const [repo, path] = useMemo(() => href?.split(':') || [], [filePath]);
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
    return hideCode && start > -1 ? [start, end ?? start] : undefined;
  }, [hideCode, start, end]);

  const handleClickFile = useCallback(() => {
    // openNewTab(
    //   {
    //     type: TabTypesEnum.FILE,
    //     repoName,
    //     repoRef,
    //     path: filePath,
    //     scrollToLine: `${start}_${end ?? start}`,
    //   },
    //   side === 'left' ? 'right' : 'left',
    // );
  }, [hideCode, start, end, path, recordId, threadId, side]);

  const handleClickFolder = useCallback(() => {
    // if (repoName) {
    //   navigateRepoPath(repoName, filePath);
    // }
  }, [path]);

  return (
    <>
      {filePath.endsWith('/') ? (
        <FolderChip onClick={handleClickFolder} path={path} repoName={repo} />
      ) : (
        <FileChip
          fileName={fileName || path || ''}
          filePath={path}
          skipIcon={!!fileName && fileName !== path}
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
