import React, { useState } from 'react';
import Breadcrumbs from '../../Breadcrumbs';
import { Repository } from '../../../icons';
import Button from '../../Button';
import { RepoType, RepoUi, SyncStatus } from '../../../types/general';
import { splitPath } from '../../../utils';
import SearchableRepoList from '../../RepoList/SearchableRepoList';

type Props = {
  type: 'local' | 'GitHub';
  setType: (t: 'local' | 'GitHub' | 'all') => void;
  repositories: RepoType[];
  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    r: (RepoType & { selected: boolean })[],
  ) => void;
  chosenFolder: string;
};

const ManageRepos = ({
  type,
  setType,
  repositories,
  handleSubmit,
  chosenFolder,
}: Props) => {
  const [repos, setRepos] = useState<RepoUi[]>(
    repositories
      .map((r) => {
        const pathParts = splitPath(r.name);
        const mainFolder = splitPath(chosenFolder).pop();
        const folderName =
          type === 'local'
            ? `/${pathParts
                .slice(pathParts.indexOf(mainFolder!), pathParts.length - 1)
                .join('/')}`
            : pathParts[0];
        return {
          ...r,
          selected: r.sync_status !== SyncStatus.Uninitialized,
          shortName: pathParts[pathParts.length - 1],
          folderName,
        };
      })
      .sort((a: RepoUi, b: RepoUi) => (a.folderName > b.folderName ? 1 : -1)),
  );
  return (
    <div className="flex flex-col overflow-auto">
      <Breadcrumbs
        path="Repositories/Local"
        pathParts={[
          {
            label: 'Repositories',
            icon: <Repository />,
            onClick: (e) => {
              e.preventDefault();
              setType('all');
            },
          },
          { label: type === 'GitHub' ? 'GitHub' : 'Local' },
        ]}
        activeStyle="secondary"
      />
      <SearchableRepoList
        activeTab={0}
        repos={repos}
        setRepos={setRepos}
        source={type}
        containerClassName="w-full mt-6"
      />
      <Button className="self-end" onClick={(e) => handleSubmit(e, repos)}>
        Re-sync
      </Button>
    </div>
  );
};

export default ManageRepos;
