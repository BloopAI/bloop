import React, { memo, useContext, useEffect, useMemo, useState } from 'react';
import { Trans } from 'react-i18next';
import { SearchContext } from '../../../context/searchContext';
import { FileTreeFileType, Repository, RepoSource } from '../../../types';
import Skeleton from '../../../components/Skeleton';
import { mapDirResult } from '../../../mappers/results';
import { DirectorySearchResponse } from '../../../types/api';
import FileIcon from '../../../components/FileIcon';
import Filters from '../../../components/Filters';
import { arrayUnique } from '../../../utils';
import { getRepoSource } from '../../../utils/file';
import { GitHubLogo, Repository as RepositoryIcon } from '../../../icons';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { STATUS_MAP } from '../../HomeTab/ReposSection/RepoCard';
import { UIContext } from '../../../context/uiContext';
import RepositoryOverview from './RepositoryOverview';

type Props = {
  repositoryData: DirectorySearchResponse;
};

const RepositoryPage = ({ repositoryData }: Props) => {
  const [repository, setRepository] = useState<Repository | undefined>();
  const [initialLoad, setInitialLoad] = useState(true);
  const { setFilters } = useContext(SearchContext.Filters);
  const { repositories } = useContext(RepositoriesContext);
  const { isRightPanelOpen } = useContext(UIContext.RightPanel);

  useEffect(() => {
    setInitialLoad(false);
  }, []);

  const repoStatus = useMemo(() => {
    return (
      repositories?.find(
        (r) => r.ref === repositoryData?.data?.[0]?.data.repo_ref,
      )?.sync_status || 'done'
    );
  }, [repositories]);

  useEffect(() => {
    if (!repositoryData) {
      return;
    }

    const data = mapDirResult(repositoryData.data[0]);
    setRepository({
      name: data.name,
      fileCount: 0,
      files: data.entries,
      commits: [],
      url: '',
      description: '',
      branches: [],
      followers: 1,
      currentPath: data.relativePath,
      source: getRepoSource(data.repoRef),
    });
  }, [repositoryData]);

  useEffect(() => {
    if (!repository?.files.length) {
      return;
    }

    const fileFilters = arrayUnique(repository.files, 'lang')
      .filter(
        (repoFile) => repoFile.type === FileTreeFileType.FILE && repoFile.lang,
      )
      .map((repoFile) => ({
        lang: repoFile.lang,
        name: repoFile.name,
      }));

    setFilters([
      {
        name: 'lang',
        type: 'checkbox',
        title: 'File Type',
        items: fileFilters.map((filter) => ({
          label: filter!.lang || '',
          checked: false,
          description: '',
          icon: <FileIcon filename={filter!.name} />,
        })),
      },
    ]);
  }, [repository]);

  const statusTextColor = useMemo(
    () => STATUS_MAP[typeof repoStatus === 'string' ? repoStatus : 'error'],
    [repoStatus],
  );

  return !repository || initialLoad ? (
    <Skeleton isRepoPage />
  ) : (
    <div className="flex flex-1 overflow-auto">
      <div className="p-12 pb-32 w-full overflow-y-auto">
        <RepositoryOverview repository={repository} syncState />
      </div>
    </div>
  );
};

export default memo(RepositoryPage);
