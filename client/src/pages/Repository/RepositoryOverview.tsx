import React, { useCallback, useEffect, useState } from 'react';
import { Remarkable } from 'remarkable';
import Accordion from '../../components/Accordion';
import FileIcon from '../../components/FileIcon';
import { FileTreeFileType, Repository } from '../../types';
import RepositoryFiles from '../../components/RepositoryFiles';
import { useSearch } from '../../hooks/useSearch';
import { SearchResponse } from '../../types/api';
import { sortFiles } from '../../utils/file';
import { isWindowsPath } from '../../utils';
import { highlightCode } from '../../utils/prism';
import useAppNavigation from '../../hooks/useAppNavigation';

const md = new Remarkable({
  html: true,
  highlight(str: string, lang: string): string {
    try {
      return highlightCode(str, lang);
    } catch (err) {
      console.log(err);
      return '';
    }
  },
});

type Props = {
  repository: Repository;
  syncState?: boolean;
};

const RepositoryOverview = ({ syncState, repository }: Props) => {
  const [sortedFiles, setSortedFiles] = useState(repository.files);

  const [readme, setReadme] = useState<{
    contents: string;
    path: string;
  } | null>(null);
  const { navigateRepoPath, navigateFullResult } = useAppNavigation();

  const { data: readmeData, searchQuery } = useSearch<SearchResponse>();
  useEffect(() => {
    const readmePath = repository.files.find((file) =>
      file.path.includes('.md'),
    );
    if (readmePath) {
      searchQuery(`open:true repo:${repository.name} path:${readmePath.path}`);
    } else {
      setReadme(null);
    }

    setSortedFiles(repository.files.sort(sortFiles));
  }, [repository.files]);

  useEffect(() => {
    if (readmeData?.data[0].kind === 'file') {
      setReadme({
        contents: md.render(readmeData.data[0].data.contents),
        path: readmeData.data[0].data.relative_path,
      });
    }
  }, [readmeData]);

  const fileClick = useCallback((path: string, type: FileTreeFileType) => {
    if (type === FileTreeFileType.FILE) {
      navigateFullResult(repository.name, path);
    } else if (type === FileTreeFileType.DIR) {
      navigateRepoPath(repository.name, path === '/' ? '' : path);
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4>Files in {repository.name}</h4>
        <p className="body-s text-gray-500"></p>
      </div>
      <div className="select-none">
        <RepositoryFiles
          files={sortedFiles}
          onClick={fileClick}
          currentPath={
            repository.currentPath
              ? `${repository.name}${
                  isWindowsPath(repository.currentPath) ? '\\' : '/'
                }${repository.currentPath.slice(0, -1)}`
              : repository.currentPath.slice(0, -1)
          }
        />
      </div>
      {readme ? (
        <div>
          <Accordion
            title={'Readme'}
            icon={<FileIcon filename={readme.path} />}
          >
            <div className="py-4 text-xs overflow-x-auto px-4 readme">
              <div dangerouslySetInnerHTML={{ __html: readme.contents }} />
            </div>
          </Accordion>
        </div>
      ) : (
        ''
      )}
    </div>
  );
};
export default RepositoryOverview;
