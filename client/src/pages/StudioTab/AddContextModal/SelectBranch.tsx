import { memo, useEffect, useMemo, useState } from 'react';
import { Trans } from 'react-i18next';
import { RepoType } from '../../../types/general';
import KeyboardChip from '../KeyboardChip';
import { Branch } from '../../../icons';

type Props = {
  search: string;
  onSubmit: (branch: string) => void;
  repo: RepoType;
};

const SelectBranch = ({ search, onSubmit, repo }: Props) => {
  const [branchesToShow, setBranchesToShow] = useState<string[]>([]);

  const allBranches = useMemo(() => {
    return [...(repo?.branch_filter?.select || [])].reverse();
  }, [repo?.branches]);

  useEffect(() => {
    const branches = allBranches.filter((r) =>
      r.toLowerCase().includes(search.toLowerCase()),
    );
    setBranchesToShow(branches);
    if (branches.length < 2) {
      onSubmit(branches[0] || '');
    }
  }, [search, allBranches]);

  return (
    <>
      {branchesToShow.map((b) => (
        <button
          type="button"
          onClick={() => onSubmit(b)}
          key={b}
          className="flex h-9 px-3 gap-3 items-center justify-between group rounded-6 bg-bg-shade hover:bg-bg-base-hover focus:bg-bg-base-hover focus:outline-0 focus:outline-none w-full cursor-pointer body-s ellipsis flex-shrink-0"
        >
          <div className="body-s text-label-base group-hover:text-label-title group-focus:text-label-title ellipsis flex gap-2 items-center">
            <Branch />
            {b.replace(/^origin\//, '')}
          </div>
          <div className="opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all flex gap-1.5 items-center caption text-label-base">
            <Trans>Select</Trans>
            <KeyboardChip type="entr" variant="tertiary" />
          </div>
        </button>
      ))}
    </>
  );
};

export default memo(SelectBranch);
