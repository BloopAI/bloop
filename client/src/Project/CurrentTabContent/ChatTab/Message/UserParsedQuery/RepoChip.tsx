import { RepositoryIcon } from '../../../../../icons';
import { splitPath } from '../../../../../utils';

type Props = {
  name: string;
};

const RepoChip = ({ name }: Props) => {
  return (
    <span
      className={`inline-flex items-center bg-bg-base rounded-4 overflow-hidden 
                text-label-title align-middle h-6`}
    >
      <span className="flex gap-1 px-1 py-0.5 items-center code-s">
        <RepositoryIcon sizeClassName="w-4 h-4" />
        <span className="">{splitPath(name).pop()}</span>
      </span>
    </span>
  );
};

export default RepoChip;
