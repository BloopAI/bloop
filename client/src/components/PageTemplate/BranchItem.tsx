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
      flex items-center justify-between rounded body-s duration-100 relative`}
      disabled={syncClicked && !isIndexed}
      onClick={() => {
        if (isIndexed) {
          setSelectedBranch(name);
          setOpen(false);
        }
      }}
    >
      <TextField
        value={name.replace('origin/', '')}
        className={`ellipsis w-full ${
          selectedBranch == name ? 'font-bold' : ''
        }`}
      />
      {selectedBranch !== name && (
        <button
          className={`caption-strong ${
            syncClicked && !isIndexed
              ? 'text-label-base'
              : 'text-bg-main hover:text-bg-main-hover'
          } py-1 px-1.5 ${
            isIndexed
              ? ''
              : 'opacity-0 group-hover:opacity-100 transition-all duration-200'
          }`}
          onClick={() => {
            if (!isIndexed) {
              indexRepoBranch(repoRef, name);
              setSyncClicked(true);
            }
          }}
        >
          {isIndexed ? (
            <span className="text-bg-main-hover">
              <CheckIcon />
            </span>
          ) : isIndexing ? (
            'Indexing...'
          ) : syncClicked ? (
            'Queued...'
          ) : (
            'Sync'
          )}
        </button>
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
