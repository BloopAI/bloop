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
  isLoading?: boolean;
  repos: RepoUi[];
  containerClassName?: string;
  source: 'local' | 'GitHub';
  onSync?: () => void;
  onFolderChange?: () => void;
};

const SearchableRepoList = ({
  repos,
  isLoading,
  containerClassName,
  source,
  onSync,
  onFolderChange,
}: Props) => {
  const [filter, setFilter] = useState('');

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  }, []);

  return (
    <div
      className={`flex flex-col overflow-auto gap-8 fade-bottom ${
        containerClassName || ''
      }`}
    >
      <TextInput
        type="search"
        value={filter}
        name="filter"
        onChange={handleChange}
        placeholder="Search repository..."
        variant="filled"
      />
      <RepoList
        repos={repos}
        source={source}
        filter={filter}
        isLoading={isLoading}
        onSync={onSync}
        onFolderChange={onFolderChange}
      />
    </div>
  );
};

export default SearchableRepoList;
