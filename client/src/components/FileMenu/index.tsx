import React, { useContext } from 'react';
import { DropdownWithIcon } from '../Dropdown';
import { MenuItemType } from '../../types/general';
import { getFileManagerName, isWindowsPath, splitPath } from '../../utils';
import { MoreHorizontal } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';

type Props = {
  repoPath: string;
  relativePath: string;
};

const FileMenu = ({ repoPath, relativePath }: Props) => {
  const { os, openFolderInExplorer } = useContext(DeviceContext);

  return repoPath.startsWith('local') ? (
    <span className="flex-shrink-0">
      <DropdownWithIcon
        items={[
          {
            type: MenuItemType.DEFAULT,
            text: `View in ${getFileManagerName(os.type)}`,
            onClick: () => {
              openFolderInExplorer(
                repoPath.slice(6) +
                  (isWindowsPath(repoPath) ? '\\' : '/') +
                  (os.type === 'Darwin'
                    ? relativePath
                    : splitPath(relativePath)
                        .slice(0, -1)
                        .join(isWindowsPath(relativePath) ? '\\' : '/')),
              );
            },
          },
        ]}
        btnOnlyIcon
        icon={<MoreHorizontal />}
        noChevron
        btnSize="small"
      />
    </span>
  ) : null;
};

export default FileMenu;
