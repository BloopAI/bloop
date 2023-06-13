import React, { ChangeEvent, useCallback, useState } from 'react';
import { MenuItemType, RepoUi } from '../../types/general';
import TextInput from '../TextInput';
import { DropdownWithIcon } from '../Dropdown';
import { Clock, SortAlphabetical } from '../../icons';
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
  const [sortBy, setSortBy] = useState<'name' | 'last_updated'>('name');

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  }, []);

  return (
    <div
      className={`flex flex-col overflow-auto gap-8 ${
        repos.filter((r) => r.name.includes(filter)).length > 3
          ? 'fade-bottom'
          : ''
      } ${containerClassName || ''}`}
    >
      <div className="flex items-center gap-1">
        <TextInput
          type="search"
          value={filter}
          name="filter"
          onChange={handleChange}
          placeholder="Search repository..."
          variant="filled"
        />
        {source !== 'local' && (
          <DropdownWithIcon
            btnVariant="secondary"
            items={[
              {
                type: MenuItemType.DEFAULT,
                text: 'Alphabetically',
                icon: <SortAlphabetical />,
                onClick: () => setSortBy('name'),
              },
              {
                type: MenuItemType.DEFAULT,
                text: 'Last updated',
                icon: <Clock />,
                onClick: () => setSortBy('last_updated'),
              },
            ]}
            icon={sortBy === 'name' ? <SortAlphabetical /> : <Clock />}
            size="small"
          />
        )}
      </div>
      <RepoList
        repos={repos}
        source={source}
        filter={filter}
        sortBy={sortBy}
        isLoading={isLoading}
        onSync={onSync}
        onFolderChange={onFolderChange}
      />
    </div>
  );
};

export default SearchableRepoList;
