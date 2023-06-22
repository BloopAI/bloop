import { useEffect, useState } from 'react';
import TextField from '../TextField';
import { CheckIcon } from '../../icons';
import { indexRepoBranch } from '../../services/api';
import ThreeDotsLoader from '../Loaders/ThreeDotsLoader';

type Props = {
  name: string;
  selectedBranch: string | null;
  setSelectedBranch: (b: string) => void;
  setOpen: (b: boolean) => void;
  repoRef: string;
  isIndexed: boolean;
  fetchRepos: () => void;
};

const BranchItem = ({
  name,
  selectedBranch,
  setSelectedBranch,
  setOpen,
  repoRef,
  isIndexed,
  fetchRepos,
}: Props) => {
  const [isIndexing, setIndexing] = useState(false);

  useEffect(() => {
    if (isIndexed) {
      setIndexing(false);
    }
  }, [isIndexed]);

  return (
    <div
      className={`p-2.5 group w-full text-left hover:bg-bg-base-hover active:bg-transparent 
      text-label-base hover:text-label-title focus:text-label-title active:text-label-title cursor-pointer 
      flex items-center justify-between rounded text-sm duration-100`}
    >
      <TextField
        value={name}
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
        <button
          className={`caption-strong text-bg-main hover:text-bg-main-hover py-1 px-1.5`}
          disabled={isIndexing}
          onClick={() => {
            if (isIndexed) {
              setSelectedBranch(name);
              setOpen(false);
            } else {
              setIndexing(true);
              indexRepoBranch(repoRef, name).then(() => {
                fetchRepos();
                setTimeout(() => fetchRepos(), 1000);
              });
            }
          }}
        >
          {isIndexed ? 'Switch' : isIndexing ? <ThreeDotsLoader /> : 'Sync'}
        </button>
      )}
    </div>
  );
};

export default BranchItem;
