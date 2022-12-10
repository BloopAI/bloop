import { useState } from 'react';
import TextInput from '../../components/TextInput';
import Tabs from '../../components/Tabs';
import { RepositoryBranch } from '../../types';
import BranchList from '../../components/BranchList';

enum Mode {
  ALL,
  ACTIVE,
  STALE,
}

type Props = {
  branches: RepositoryBranch[];
};

const RepositoryBranches = ({ branches }: Props) => {
  const [currentTab, setCurrentTab] = useState<Mode>(0);
  const [searchValue, setSearchValue] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row justify-between ">
        <span className="w-1/2">
          <TextInput
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            name={'Search'}
            placeholder={'Search branches'}
            variant={'filled'}
            type={'search'}
          />
        </span>
        <span className="w-1/2 pl-12">
          <Tabs
            activeTab={currentTab}
            onTabChange={setCurrentTab}
            size={'medium'}
            fullWidth
            tabs={[{ title: 'All' }, { title: 'Active' }, { title: 'Stale' }]}
            variant={'button'}
            divider
          />
        </span>
      </div>
      {(currentTab === Mode.ALL || currentTab === Mode.ACTIVE) && (
        <BranchList
          title={'Active branches'}
          branches={branches.filter((branch) => branch.active)}
        />
      )}
      {(currentTab === Mode.ALL || currentTab === Mode.STALE) && (
        <BranchList
          title={'Stale branches'}
          branches={branches.filter((branch) => !branch.active)}
        />
      )}
    </div>
  );
};

export default RepositoryBranches;
