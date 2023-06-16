import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Remarkable } from 'remarkable';
import Accordion from '../../components/Accordion';
import FileIcon from '../../components/FileIcon';
import { FileTreeFileType, Repository } from '../../types';
import RepositoryFiles from '../../components/RepositoryFiles';
import { useSearch } from '../../hooks/useSearch';
import { FileSearchResponse } from '../../types/api';
import { cleanRepoName, sortFiles } from '../../utils/file';
import { highlightCode } from '../../utils/prism';
import useAppNavigation from '../../hooks/useAppNavigation';
import { DeviceContext } from '../../context/deviceContext';
import { buildRepoQuery } from '../../utils';
import { SearchContext } from '../../context/searchContext';

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
  linkTarget: '__blank',
});

type Props = {
  repository: Repository;
  syncState?: boolean;
};

const RepositoryOverview = ({ syncState, repository }: Props) => {
  const [sortedFiles, setSortedFiles] = useState(repository.files);
  const { openLink } = useContext(DeviceContext);
  const { selectedBranch } = useContext(SearchContext);

  const [readme, setReadme] = useState<{
    contents: string;
    path: string;
  } | null>(null);
  const { navigateRepoPath, navigateFullResult } = useAppNavigation();

  const { data: readmeData, searchQuery } = useSearch<FileSearchResponse>();
  useEffect(() => {
    const readmePath = repository.files.find(
      (file) => file.path.toLowerCase() === 'readme.md',
    );
    if (readmePath) {
      searchQuery(
        buildRepoQuery(repository.name, readmePath.path, selectedBranch),
      );
    } else {
      setReadme(null);
    }

    setSortedFiles(repository.files.sort(sortFiles));
  }, [repository.files, selectedBranch]);

  useEffect(() => {
    if (!readmeData) {
      return;
    }
    setReadme({
      contents: md.render(readmeData.data[0].data.contents),
      path: readmeData.data[0].data.relative_path,
    });
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
      </div>
      <div className="">
        <RepositoryFiles
          files={sortedFiles}
          onClick={fileClick}
          repositoryName={cleanRepoName(repository.name)}
          currentPath={repository.currentPath.slice(0, -1)}
        />
      </div>
      {readme ? (
        <div>
          <Accordion
            title={'Readme'}
            icon={<FileIcon filename={readme.path} />}
          >
            <div className="py-4 text-xs overflow-x-auto px-4 readme">
              <div
                dangerouslySetInnerHTML={{ __html: readme.contents }}
                onClick={(e) => {
                  // @ts-ignore
                  const { href } = e.target;
                  if (href) {
                    e.preventDefault();
                    openLink(href);
                  }
                }}
              />
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
