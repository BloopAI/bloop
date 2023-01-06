import React, {
  ChangeEvent,
  Dispatch,
  SetStateAction,
  useCallback,
  useState,
} from 'react';
import Tabs from '../Tabs';
import { RepoUi } from '../../types/general';
import TextInput from '../TextInput';
import RepoList from './index';

type Props = {
  readOnly?: boolean;
  activeTab: number;
  setActiveTab?: (t: number) => void;
  repos: RepoUi[];
  setRepos: Dispatch<SetStateAction<RepoUi[]>>;
  containerClassName?: string;
  source: 'local' | 'GitHub';
};

const tabs = [{ title: 'Sync all repos' }, { title: 'Sync selected repos' }];

const SearchableRepoList = ({
  readOnly,
  activeTab,
  setActiveTab,
  repos,
  setRepos,
  containerClassName,
  source,
}: Props) => {
  const [filter, setFilter] = useState('');

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  }, []);

  return (
    <div
      className={`flex flex-col overflow-auto gap-3 ${
        containerClassName || ''
      }`}
    >
      <TextInput
        type="search"
        value={filter}
        name="filter"
        onChange={handleChange}
        placeholder="Search..."
      />
      {!readOnly && (
        <div className="overflow-hidden flex-shrink-0">
          <Tabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabs}
            variant="button"
            fullWidth
          />
        </div>
      )}
      <RepoList
        repos={repos}
        setRepos={setRepos}
        source={source}
        activeTab={activeTab}
        filter={filter}
      />
    </div>
  );
};

export default SearchableRepoList;
