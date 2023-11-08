import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { RepoType } from '../../../../types/general';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import BranchItem from './BranchItem';

type Props = {
  search: string;
  onSubmit: (branch: string) => void;
  repo: RepoType;
};

const SelectBranch = ({ search, onSubmit, repo }: Props) => {
  const [branchesToShow, setBranchesToShow] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          onSubmit(branchesToShow[highlightedIndex]);
        }
      } else {
        if (e.key === 'ArrowDown') {
          setHighlightedIndex((prev) =>
            prev < branchesToShow.length - 1 ? prev + 1 : 0,
          );
        } else if (e.key === 'ArrowUp') {
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : branchesToShow.length - 1,
          );
        }
      }
    },
    [branchesToShow, highlightedIndex, onSubmit],
  );
  useKeyboardNavigation(handleKeyEvent);

  const allBranches = useMemo(() => {
    return [...(repo?.branch_filter?.select || [])].reverse();
  }, [repo?.branches]);

  useEffect(() => {
    const branches = allBranches.filter((r) =>
      r.toLowerCase().includes(search.toLowerCase()),
    );
    setBranchesToShow(branches);
  }, [search, allBranches]);

  useEffect(() => {
    if (allBranches.length < 2) {
      onSubmit(allBranches[0] || '');
    }
  }, [allBranches]);

  return (
    <>
      {branchesToShow.map((b, i) => (
        <BranchItem
          key={b}
          onSubmit={onSubmit}
          name={b}
          setHighlightedIndex={setHighlightedIndex}
          i={i}
          isFocused={highlightedIndex === i}
        />
      ))}
    </>
  );
};

export default memo(SelectBranch);
