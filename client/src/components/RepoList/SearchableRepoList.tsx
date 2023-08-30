import React, { ChangeEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItemType, RepoUi } from '../../types/general';
import TextInput from '../TextInput';
import { DropdownWithIcon } from '../Dropdown';
import { Clock, SortAlphabetical } from '../../icons';
import { CodeStudioType } from '../../types/api';
import RepoList from './index';

type GeneralProps = {
  isLoading?: boolean;
  containerClassName?: string;
  onSync?: (refOrId: string) => void;
};

type StudioProps = {
  type: 'studio';
  items: CodeStudioType[];
  onFolderChange?: never;
} & GeneralProps;

type RepoProps = {
  type: 'local' | 'GitHub';
  items: RepoUi[];
  onFolderChange?: () => void;
} & GeneralProps;

type Props = StudioProps | RepoProps;

const SearchableRepoList = ({ containerClassName, ...restProps }: Props) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'last_updated'>('name');

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  }, []);

  return (
    <div
      className={`flex flex-col overflow-auto gap-8 ${
        restProps.type !== 'studio' &&
        restProps.items.filter((r) => r.name.includes(filter)).length > 3
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
          placeholder={t('Search repository...')}
          variant="filled"
        />
        {restProps.type !== 'local' && (
          <DropdownWithIcon
            btnVariant="secondary"
            items={[
              {
                type: MenuItemType.DEFAULT,
                text: t('Alphabetically'),
                icon: <SortAlphabetical />,
                onClick: () => setSortBy('name'),
              },
              {
                type: MenuItemType.DEFAULT,
                text: t('Last updated'),
                icon: <Clock />,
                onClick: () => setSortBy('last_updated'),
              },
            ]}
            icon={sortBy === 'name' ? <SortAlphabetical /> : <Clock />}
            size="small"
          />
        )}
      </div>
      <RepoList {...restProps} filter={filter} sortBy={sortBy} />
    </div>
  );
};

export default SearchableRepoList;
