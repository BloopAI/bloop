import React, { useState } from 'react';
import { Branch, Version } from '../../icons';
import { FileTreeFileType } from '../../types';
import { FileTreeItem } from '../../types/results';
import FileTree from './FileTree';
import ListNavigation from './ListNavigation';
import NavigationPanel from './NavigationPanel';

type Props = {
  repoName: string;
  files: FileTreeItem[];
  branches: { title: string }[];
  versions: { title: string }[];
  initialBranch?: number;
  initialVersion?: number;
  currentPath: string;
  onFileClick: (p: string, type: FileTreeFileType) => void;
};

const IdeNavigation = ({
  repoName,
  files,
  versions,
  branches,
  initialVersion,
  initialBranch,
  currentPath,
  onFileClick,
}: Props) => {
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>(
    initialBranch,
  );
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    initialVersion,
  );

  return (
    <NavigationPanel repoName={repoName}>
      <span>
        <FileTree
          items={files}
          onFileClick={onFileClick}
          currentPath={currentPath}
        />
      </span>
      {branches.length > 0 && (
        <ListNavigation
          title="Branch"
          items={branches}
          icon={<Branch />}
          selected={selectedBranch}
          setSelected={setSelectedBranch}
          dense
        />
      )}
      {versions.length > 0 && (
        <ListNavigation
          title="Version"
          items={versions}
          icon={<Version />}
          setSelected={setSelectedVersion}
          selected={selectedVersion}
          dense
        />
      )}
    </NavigationPanel>
  );
};
export default IdeNavigation;
