import { memo, useCallback, useContext, useEffect, useRef } from 'react';
import FileIcon from '../../../../components/FileIcon';
import { TabTypesEnum } from '../../../../types/general';
import { TabsContext } from '../../../../context/tabsContext';
import { RepoFileNameItem } from '../../../../types/api';
import { FolderIcon } from '../../../../icons';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';

type Props = {
  relative_path: RepoFileNameItem;
  repo_ref: string;
  is_dir: boolean;
  isFocused: boolean;
  isFirst: boolean;
};

const FileResult = ({
  relative_path,
  repo_ref,
  is_dir,
  isFocused,
  isFirst,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        e.preventDefault();
        if (!is_dir) {
          openNewTab({
            type: TabTypesEnum.FILE,
            path: relative_path.text,
            repoRef: repo_ref,
          });
        }
      }
    },
    [repo_ref, relative_path, is_dir, openNewTab],
  );
  useKeyboardNavigation(handleKeyEvent, !isFocused);

  const handleClick = useCallback(() => {
    if (is_dir) {
      return;
    }
    openNewTab({
      type: TabTypesEnum.FILE,
      path: relative_path.text,
      repoRef: repo_ref,
    });
  }, [relative_path, repo_ref, is_dir, openNewTab]);
  return (
    <div
      className={`flex items-center w-max gap-3 body-mini text-label-title h-7 flex-shrink-0 cursor-pointer  ${
        isFirst ? 'scroll-mt-10' : ''
      } scroll-ml-10 ${isFocused ? 'bg-bg-shade-hover' : ''} pl-10 pr-4`}
      ref={ref}
    >
      {is_dir ? (
        <FolderIcon sizeClassName="w-4 h-4" />
      ) : (
        <FileIcon filename={relative_path.text} noMargin />
      )}
      {/*<BreadcrumbsPathContainer*/}
      {/*  path={is_dir ? relative_path.text.slice(0, -1) : relative_path.text}*/}
      {/*  onClick={handleClick}*/}
      {/*  repo={repo_ref}*/}
      {/*/>*/}
      <div onClick={handleClick}>{relative_path.text}</div>
    </div>
  );
};

export default memo(FileResult);
