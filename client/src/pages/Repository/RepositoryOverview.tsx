import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Accordion from '../../components/Accordion';
import FileIcon from '../../components/FileIcon';
import { Repository } from '../../types';
import RepositoryFiles from '../../components/RepositoryFiles';
import { UIContext } from '../../context/uiContext';
import { useSearch } from '../../hooks/useSearch';
import { SearchResponse } from '../../types/api';
import Code from '../../components/CodeBlock/Code';
import { sortFiles } from '../../utils/file';
import { isWindowsPath } from '../../utils';

type Props = {
  repository: Repository;
  syncState?: boolean;
  sidebarOpen?: boolean;
};

const RepositoryOverview = ({ syncState, repository, sidebarOpen }: Props) => {
  const [sortedFiles, setSortedFiles] = useState(repository.files);
  const { setBackButtonHandler, setBackButtonEnabled } = useContext(UIContext);

  const [readme, setReadme] = useState<{
    contents: string;
    path: string;
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setBackButtonEnabled(true);
    setBackButtonHandler(() => () => {
      navigate(-1);
    });
    return () => setBackButtonEnabled(false);
  }, []);

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
        contents: readmeData.data[0].data.contents,
        path: readmeData.data[0].data.relative_path,
      });
    }
  }, [readmeData]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4>Files in {repository.name}</h4>
        <p className="body-s text-gray-500"></p>
      </div>
      <div className="select-none">
        <RepositoryFiles
          files={sortedFiles}
          onClick={(p: string, shouldReplace?: boolean) => {
            navigate(
              `/results?q=open:true repo:${encodeURIComponent(
                repository.name,
              )} ${p.length ? `path:${encodeURIComponent(p)}` : ''}`,
              { replace: shouldReplace && sidebarOpen },
            );
          }}
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
            <div className="py-4 text-xs overflow-x-auto">
              <Code
                code={readme.contents}
                language={'markdown'}
                showLines={false}
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
