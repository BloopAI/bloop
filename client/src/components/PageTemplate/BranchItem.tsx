import TextField from '../TextField';
import { CheckIcon } from '../../icons';
import { indexRepoBranch } from '../../services/api';

type Props = {
  name: string;
  selectedBranch: string | null;
  setSelectedBranch: (b: string) => void;
  setOpen: (b: boolean) => void;
  repoRef: string;
  isIndexed: boolean;
  onIndex: (b: string) => void;
};

const BranchItem = ({
  name,
  selectedBranch,
  setSelectedBranch,
  setOpen,
  repoRef,
  isIndexed,
  onIndex,
}: Props) => {
  return (
    <button
      className={`p-2.5 group w-full text-left hover:bg-bg-base-hover active:bg-transparent 
      text-label-base hover:text-label-title focus:text-label-title active:text-label-title cursor-pointer 
      flex items-center justify-between rounded text-sm duration-100`}
      onClick={() => {
        if (isIndexed) {
          setSelectedBranch(name);
          setOpen(false);
        } else {
          indexRepoBranch(repoRef, name);
          onIndex(name);
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
          className={`caption-strong text-bg-main hover:text-bg-main-hover py-1 px-1.5`}
        >
          {isIndexed ? 'Switch' : 'Sync'}
        </span>
      )}
    </button>
  );
};

export default BranchItem;
