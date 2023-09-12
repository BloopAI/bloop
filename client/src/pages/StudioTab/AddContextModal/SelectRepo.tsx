import { memo, useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { getIndexedRepos } from '../../../services/api';
import { RepoType, StudioContextFile } from '../../../types/general';
import KeyboardChip from '../KeyboardChip';
import { getFileExtensionForLang } from '../../../utils';
import FileIcon from '../../../components/FileIcon';
import LiteLoaderContainer from '../../../components/Loaders/LiteLoader';

type Props = {
  search: string;
  onSubmit: (repo: RepoType) => void;
  contextFiles: StudioContextFile[];
  canSkip?: boolean;
};

const SelectRepo = ({ search, onSubmit, contextFiles, canSkip }: Props) => {
  useTranslation();
  const [reposToShow, setReposToShow] = useState<RepoType[]>([]);
  const [repos, setRepos] = useState<RepoType[]>([]);

  useEffect(() => {
    getIndexedRepos().then((data) => {
      setRepos(data.list);
      setReposToShow(
        data.list.filter((r) =>
          r.name.toLowerCase().includes(search.toLowerCase()),
        ),
      );
    });
  }, []);

  useEffect(() => {
    setReposToShow(
      repos.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    );
  }, [search, repos]);

  useEffect(() => {
    if (canSkip || repos.length === 1) {
      const allFilesFromOneRepo =
        Array.from(new Set(contextFiles.map((f) => f.repo))).length === 1;
      if (
        (allFilesFromOneRepo && contextFiles?.[0]?.repo) ||
        repos.length === 1
      ) {
        const repo =
          repos.length === 1
            ? repos[0]
            : repos.find((r) => r.ref === contextFiles[0].repo);
        if (repo) {
          onSubmit(repo);
        }
      }
    }
  }, [repos, canSkip]);

  const handleSubmit = useCallback((r: RepoType) => {
    if (!r.last_index || r.last_index === '1970-01-01T00:00:00Z') {
      return;
    }
    onSubmit(r);
  }, []);

  return (
    <>
      {reposToShow.map((r) => (
        <button
          type="button"
          onClick={() => handleSubmit(r)}
          key={r.ref}
          className="flex h-9 px-3 gap-3 items-center justify-between group rounded-6 bg-bg-shade hover:bg-bg-base-hover focus:bg-bg-base-hover focus:outline-0 focus:outline-none w-full cursor-pointer body-s ellipsis flex-shrink-0"
        >
          <div className="body-s text-label-base group-hover:text-label-title group-focus:text-label-title ellipsis flex gap-2 items-center">
            <FileIcon filename={getFileExtensionForLang(r.most_common_lang)} />
            {r.name}
            {(!r.last_index || r.last_index === '1970-01-01T00:00:00Z') && (
              <div className="h-5 px-1 flex items-center gap-1 rounded-sm bg-label-muted/15 caption text-label-base flex-shrink-0 w-fit select-none">
                <LiteLoaderContainer sizeClassName="w-3.5 h-3.5" />
                <Trans>Indexing...</Trans>
              </div>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all flex gap-1.5 items-center caption text-label-base">
            <Trans>
              {!r.last_index || r.last_index === '1970-01-01T00:00:00Z'
                ? 'Unavailable'
                : 'Select'}
            </Trans>
            {r.last_index && r.last_index !== '1970-01-01T00:00:00Z' && (
              <KeyboardChip type="entr" variant="tertiary" />
            )}
          </div>
        </button>
      ))}
    </>
  );
};

export default memo(SelectRepo);
