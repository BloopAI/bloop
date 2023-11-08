import { memo, useCallback, useEffect, useState } from 'react';
import { RepoType, StudioContextFile } from '../../../../types/general';
import { searchFiles } from '../../../../services/api';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import FileItem from './FileItem';

type Props = {
  search: string;
  branch: string;
  onSubmit: (file: string, isMultiSelect?: boolean) => void;
  repo: RepoType;
  filterOutFiles: StudioContextFile[];
};

const SelectFile = ({
  search,
  onSubmit,
  repo,
  branch,
  filterOutFiles,
}: Props) => {
  const [filesToShow, setFilesToShow] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          onSubmit(filesToShow[highlightedIndex], e.shiftKey);
        }
      } else {
        if (e.key === 'ArrowDown') {
          setHighlightedIndex((prev) =>
            prev < filesToShow.length - 1 ? prev + 1 : 0,
          );
        } else if (e.key === 'ArrowUp') {
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filesToShow.length - 1,
          );
        }
      }
    },
    [filesToShow, highlightedIndex, onSubmit],
  );
  useKeyboardNavigation(handleKeyEvent);

  useEffect(() => {
    searchFiles(`${search || '.'} branch:${branch}`, repo.ref).then((resp) => {
      setFilesToShow(
        resp.data
          .map((r) =>
            r.kind === 'file_result' ? r.data.relative_path.text : null,
          )
          .filter(
            (f): f is string =>
              !!f &&
              !filterOutFiles.find(
                (o) =>
                  o.path === f && o.repo === repo.ref && o.branch === branch,
              ),
          ),
      );
    });
  }, [search, branch, repo.name, filterOutFiles]);

  return (
    <>
      {filesToShow.map((f, i) => (
        <FileItem
          key={f}
          onSubmit={onSubmit}
          filename={f}
          setHighlightedIndex={setHighlightedIndex}
          i={i}
          isFocused={highlightedIndex === i}
        />
      ))}
    </>
  );
};

export default memo(SelectFile);
