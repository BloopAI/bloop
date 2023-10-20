import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Remarkable } from 'remarkable';
import { Trans } from 'react-i18next';
import sanitizeHtml from 'sanitize-html';
import Accordion from '../../../components/Accordion';
import FileIcon from '../../../components/FileIcon';
import { FileTreeFileType, Repository } from '../../../types';
import RepositoryFiles from '../../../components/RepositoryFiles';
import { useSearch } from '../../../hooks/useSearch';
import { FileSearchResponse } from '../../../types/api';
import { cleanRepoName, sortFiles } from '../../../utils/file';
import { highlightCode } from '../../../utils/prism';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { DeviceContext } from '../../../context/deviceContext';
import { buildRepoQuery } from '../../../utils';
import { SearchContext } from '../../../context/searchContext';
import { SyncStatus } from '../../../types/general';

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
  repoStatus: SyncStatus;
  markRepoIndexing: () => void;
};

const RepositoryOverview = ({
  repository,
  repoStatus,
  markRepoIndexing,
}: Props) => {
  const [sortedFiles, setSortedFiles] = useState(repository.files);
  const { openLink } = useContext(DeviceContext);
  const { selectedBranch } = useContext(SearchContext.SelectedBranch);

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
    if (!readmeData?.data?.[0]?.data?.contents) {
      return;
    }
    setReadme({
      contents: md.render(readmeData.data[0].data.contents),
      path: readmeData.data[0].data.relative_path,
    });
  }, [readmeData]);

  const fileClick = useCallback((path: string, type: FileTreeFileType) => {
    if (type === FileTreeFileType.FILE) {
      navigateFullResult(path);
    } else if (type === FileTreeFileType.DIR) {
      navigateRepoPath(repository.name, path === '/' ? '' : path);
    }
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // @ts-ignore
      const { href } = e.target;
      if (href) {
        e.preventDefault();
        openLink(href);
      }
    },
    [openLink],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4>
          <Trans>Files in</Trans> {repository.name}
        </h4>
      </div>
      <div className="">
        <RepositoryFiles
          files={sortedFiles}
          onClick={fileClick}
          repositoryName={cleanRepoName(repository.name)}
          currentPath={repository.currentPath.slice(0, -1)}
          repoStatus={repoStatus}
          markRepoIndexing={markRepoIndexing}
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
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(readme.contents, {
                    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
                      'img',
                    ]),
                    allowedAttributes: { img: ['src', 'alt'] },
                  }),
                }}
                onClick={handleClick}
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
export default memo(RepositoryOverview);
