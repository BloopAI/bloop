import React, { useState } from 'react';
import { Branch, Version } from '../../icons';
import FileTree, { FileItemType } from './FileTree';
import ListNavigation from './ListNavigation';
import NavigationPanel from './NavigationPanel';

type Props = {
  repoName: string;
  files: FileItemType[];
  branches: { title: string }[];
  versions: { title: string }[];
  onBackNavigate: () => void;
  initialBranch?: number;
  initialVersion?: number;
};

const IdeNavigation = ({
  repoName,
  files,
  versions,
  branches,
  onBackNavigate,
  initialVersion,
  initialBranch,
}: Props) => {
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>(
    initialBranch,
  );
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    initialVersion,
  );

  return (
    <NavigationPanel onBackNavigate={onBackNavigate} repoName={repoName}>
      <span>
        <FileTree items={files} />
      </span>
      <ListNavigation
        title="Branch"
        items={branches}
        icon={<Branch />}
        selected={selectedBranch}
        setSelected={setSelectedBranch}
        dense
      />
      <ListNavigation
        title="Version"
        items={versions}
        icon={<Version />}
        setSelected={setSelectedVersion}
        selected={selectedVersion}
        dense
      />
    </NavigationPanel>
  );
};
export default IdeNavigation;
