import { useState } from 'react';
import TextField from '../TextField';
import { CheckIcon } from '../../icons';
import { indexRepoBranch } from '../../services/api';
import ProgressBar from '../ProgressBar';

type Props = {
  name: string;
  selectedBranch: string | null;
  setSelectedBranch: (b: string) => void;
  setOpen: (b: boolean) => void;
  repoRef: string;
  isIndexed: boolean;
  isIndexing: boolean;
  percentage: number;
};

const BranchItem = ({
  name,
  selectedBranch,
  setSelectedBranch,
  setOpen,
  repoRef,
  isIndexed,
  isIndexing,
  percentage,
}: Props) => {
  const [syncClicked, setSyncClicked] = useState(false);
  return (
    <button
      className={`p-2.5 group w-full text-left hover:bg-bg-base-hover active:bg-transparent 
      text-label-base hover:text-label-title focus:text-label-title active:text-label-title cursor-pointer 
      flex items-center justify-between rounded text-sm duration-100 relative`}
      disabled={syncClicked && !isIndexed}
      onClick={() => {
        if (isIndexed) {
          setSelectedBranch(name);
          setOpen(false);
        } else {
          indexRepoBranch(repoRef, name);
          setSyncClicked(true);
        }
      }}
    >
      <TextField
        value={name.replace('origin/', '')}
        icon={
          selectedBranch === name ? (
            <span className="w-5 h-5 text-bg-success">
              <CheckIcon />
            </span>
          ) : undefined
        }
        className="ellipsis w-full"
      />
      {selectedBranch !== name && (
        <span
          className={`caption-strong ${
            syncClicked && !isIndexed
              ? 'text-label-base'
              : 'text-bg-main hover:text-bg-main-hover'
          } py-1 px-1.5`}
        >
          {isIndexed
            ? 'Switch'
            : isIndexing
            ? 'Indexing...'
            : syncClicked
            ? 'Queued...'
            : 'Sync'}
        </span>
      )}
      {syncClicked && !isIndexed && isIndexing && (
        <div className="absolute bottom-1.5 left-0 w-full px-2">
          <ProgressBar progress={percentage} />
        </div>
      )}
    </button>
  );
};

export default BranchItem;
