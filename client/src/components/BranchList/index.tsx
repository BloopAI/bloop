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
      <div className="flex flex-col divide-gray-700 divide-gray-700 divide-y rounded border border-gray-700">
        {branches.map((branch, id) => (
          <span
            key={id}
            className="flex flex-row px-2 py-4 items-center bg-gray-900 first:rounded-t last:rounded-b"
          >
            <span className="flex flex-row items-center gap-3 w-1/2 text-xs">
              <span className="hover:underline cursor-pointer">
                <Badge active={branch.main} text={branch.name} />
              </span>
              <span>
                <span className="text-gray-500 select-none">
                  Updated {format(branch.commit.datetime)}{' '}
                </span>
                <span className="cursor-pointer hover:underline">
                  {branch.commit.author}
                </span>
              </span>
            </span>
            <span className="text-gray-500 text-sm select-none">
              {branch.files}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default BranchList;
