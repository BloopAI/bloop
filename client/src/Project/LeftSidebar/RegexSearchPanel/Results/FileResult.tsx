import { memo, useCallback, useContext } from 'react';
import FileIcon from '../../../../components/FileIcon';
import BreadcrumbsPathContainer from '../../../../components/Breadcrumbs/PathContainer';
import { TabTypesEnum } from '../../../../types/general';
import { TabsContext } from '../../../../context/tabsContext';
import { RepoFileNameItem } from '../../../../types/api';
import { FolderIcon } from '../../../../icons';

type Props = {
  relative_path: RepoFileNameItem;
  repo_name: string;
  repo_ref: string;
  is_dir: boolean;
};

const FileResult = ({ relative_path, repo_ref, repo_name, is_dir }: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const handleClick = useCallback(() => {
    if (is_dir) {
      return;
    }
    openNewTab({
      type: TabTypesEnum.FILE,
      path: relative_path.text,
      repoName: repo_name,
      repoRef: repo_ref,
    });
  }, [relative_path, repo_ref, repo_name, is_dir, openNewTab]);
  return (
    <div className="flex items-center gap-3 body-mini text-label-title h-7 flex-shrink-0 cursor-pointer">
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
