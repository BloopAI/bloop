import Dropdown from '../../components/Dropdown/Normal';
import { Branch } from '../../icons';
import { MenuItemType } from '../../types/general';
import CommitHistory from '../../components/CommitHistory';
import { Commit } from '../../types';
import Button from '../../components/Button';

type Props = {
  branches: string[];
  commits: Commit[];
};

const RepositoryCommits = ({ branches, commits }: Props) => {
  return (
    <div className="flex flex-col">
      <Dropdown
        items={branches.map((branch) => ({
          icon: <Branch />,
          type: MenuItemType.LINK,
          text: branch,
        }))}
      />
      <CommitHistory commits={commits} />

      <div className="flex flex-row mt-6 justify-around ">
        <Button variant="secondary" size={'small'}>
          Load more
        </Button>
      </div>
    </div>
  );
};

export default RepositoryCommits;
