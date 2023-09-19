import React, { memo, useContext, useEffect, useState } from 'react';
import { SearchContext } from '../../../context/searchContext';
import { FileTreeFileType, Repository } from '../../../types';
import Skeleton from '../../../components/Skeleton';
import { mapDirResult } from '../../../mappers/results';
import { DirectorySearchResponse } from '../../../types/api';
import FileIcon from '../../../components/FileIcon';
import { arrayUnique } from '../../../utils';
import { getRepoSource } from '../../../utils/file';
import RepositoryOverview from './RepositoryOverview';

type Props = {
  repositoryData: DirectorySearchResponse;
};

const RepositoryPage = ({ repositoryData }: Props) => {
  const [repository, setRepository] = useState<Repository | undefined>();
  const [initialLoad, setInitialLoad] = useState(true);
  const { setFilters } = useContext(SearchContext.Filters);

  useEffect(() => {
    setInitialLoad(false);
  }, []);

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
