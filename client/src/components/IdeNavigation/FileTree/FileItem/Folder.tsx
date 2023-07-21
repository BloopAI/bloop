import { useState } from 'react';
import { FolderFilled } from '../../../../icons';
import { FileTreeFileType } from '../../../../types';
import NavigationItem from '../../NavigationItem';

const Folder = ({ name, path }) => {
  const [isOpen, setOpen] = useState(false);
  return (
    <NavigationItem
      icon={<FolderFilled />}
      value={item.name}
      variant={'default'}
      onClick={() => {
        navigateRepoPath(result.repoName, path);
        handleClick(`${currentPath}/`, FileTreeFileType.DIR);
      }}
    />
  );
};

export default Folder;
