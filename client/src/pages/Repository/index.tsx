import React, { useContext, useEffect, useState } from 'react';
import { SearchContext } from '../../context/searchContext';
import { FileTreeFileType, Repository } from '../../types';
import Skeleton from '../Skeleton';
import { mapDirResult } from '../../mappers/results';
import { DirectorySearchResponse } from '../../types/api';
import FileIcon from '../../components/FileIcon';
import Filters from '../../components/Filters';
import RepositoryOverview from './RepositoryOverview';

type Props = {
  repositoryData: DirectorySearchResponse;
  loading: boolean;
};

const RepositoryPage = ({ repositoryData, loading }: Props) => {
  const [repository, setRepository] = useState<Repository | undefined>();
  const { setFilters } = useContext(SearchContext);

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
    });
  }, [repositoryData]);

  useEffect(() => {
    if (!repository?.files.length) {
      return;
    }

    const fileFilters = repository.files
      .map((repoFile) => {
        if (repoFile.type === FileTreeFileType.FILE && repoFile.lang) {
          return {
            lang: repoFile.lang,
            name: repoFile.name,
          };
        }
      })
      .filter(Boolean);

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

  return !repository || loading ? (
    <Skeleton />
  ) : (
    <div className="flex w-full">
      <div className="h-full flex flex-col overflow-hidden relative overflow-y-auto w-[20.25rem] flex-shrink-0">
        <div className="p-8 flex flex-row gap-6 justify-between select-none cursor-default">
          <span className="flex flex-col gap-3">
            <span className="flex flex-row gap-4 items-center">
              <span className="bg-gray-800 rounded-md p-1 select-none">
                <img src={'/repo_logo.png'} />
              </span>
              <span className="flex flex-col">
                <span>{repository.name}</span>
                <span className={`flex items-center gap-2 `}>
                  <div className={`w-2 h-2 rounded-xl bg-success-600`} />
                  <span className="ellipsis text-gray-500 text-xs select-none">
                    Synced
                  </span>
                </span>
              </span>
            </span>
          </span>
        </div>
        <div className="flex-1 flex">
          <Filters isOpen={true} toggleOpen={() => {}} showHeader={false} />
        </div>
      </div>
      <div className="p-12 w-full overflow-y-auto">
        <RepositoryOverview repository={repository} syncState />
      </div>
    </div>
  );
};

export default RepositoryPage;
