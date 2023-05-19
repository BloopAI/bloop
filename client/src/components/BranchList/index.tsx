import { format } from 'timeago.js';
import Badge from '../Badge';
import { RepositoryBranch } from '../../types';

type Props = {
  title: string;
  branches: RepositoryBranch[];
};

const BranchList = ({ title, branches }: Props) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="select-none">{title}</span>
      <div className="flex flex-col divide-bg-border divide-y rounded border border-bg-border">
        {branches.map((branch, id) => (
          <span
            key={id}
            className="flex flex-row px-2 py-4 items-center bg-bg-sub first:rounded-t last:rounded-b"
          >
            <span className="flex flex-row items-center gap-3 w-1/2 text-xs text-label-base">
              <span className="hover:underline cursor-pointer">
                <Badge active={branch.main} text={branch.name} />
              </span>
              <span>
                <span className="text-label-muted select-none">
                  Updated {format(branch.commit.datetime)}{' '}
                </span>
                <span className="cursor-pointer hover:underline">
                  {branch.commit.author}
                </span>
              </span>
            </span>
            <span className="text-label-muted text-sm select-none">
              {branch.files}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default BranchList;
