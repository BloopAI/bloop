import { memo, useCallback, useEffect, useState } from 'react';
import { getIndexedRepos } from '../../../../services/api';
import { RepoType, StudioContextFile } from '../../../../types/general';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import RepoItem from './RepoItem';

type Props = {
  search: string;
  onSubmit: (repo: RepoType) => void;
  contextFiles: StudioContextFile[];
  canSkip?: boolean;
};

const SelectRepo = ({ search, onSubmit, contextFiles, canSkip }: Props) => {
  const [reposToShow, setReposToShow] = useState<RepoType[]>([]);
  const [repos, setRepos] = useState<RepoType[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          onSubmit(reposToShow[highlightedIndex]);
        }
      } else {
        if (e.key === 'ArrowDown') {
          setHighlightedIndex((prev) =>
            prev < reposToShow.length - 1 ? prev + 1 : 0,
          );
        } else if (e.key === 'ArrowUp') {
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : reposToShow.length - 1,
          );
        }
      }
    },
    [reposToShow, highlightedIndex, onSubmit],
  );
  useKeyboardNavigation(handleKeyEvent);

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

  return (
    <>
      {reposToShow.map(({ ref, ...r }, i) => (
        <RepoItem
          key={ref}
          {...r}
          repoRef={ref}
          onSubmit={onSubmit}
          setHighlightedIndex={setHighlightedIndex}
          i={i}
          isFocused={highlightedIndex === i}
        />
      ))}
    </>
  );
};

export default memo(SelectRepo);
