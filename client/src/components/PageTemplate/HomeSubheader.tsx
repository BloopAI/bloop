import { ChangeEvent, memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyTool } from '../../icons';
import TextInput from '../TextInput';
import { UIContext } from '../../context/uiContext';
import TabButton from './TabButton';

type Props = {};

const HomeSubheader = ({}: Props) => {
  const { t } = useTranslation();
  const { search, setSearch, setFilterType, filterType } = useContext(
    UIContext.HomeScreen,
  );

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);
  return (
    <div className="w-full bg-bg-shade py-2 px-6 flex items-center justify-between border-b border-bg-border shadow-medium relative z-70 h-12 flex-shrink-0">
      <div className="w-80">
        <TextInput
          value={search}
          name={'search_repo'}
          onChange={onChange}
          startIcon={<MagnifyTool />}
          placeholder={t('Search repos or Studio projects...')}
          type="search"
          variant="filled"
          height="small"
        />
      </div>
      <div className="flex items-stretch gap-0.5 bg-bg-base rounded p-0.5 h-7 ">
        <TabButton
          isActive={filterType === 'all'}
          name={t('All')}
          onClick={() => setFilterType('all')}
        />
        <TabButton
          isActive={filterType === 'repos'}
          name={t('Repositories')}
          onClick={() => setFilterType('repos')}
        />
        <div className="h-3 w-px bg-bg-border my-1.5" />
        <TabButton
          isActive={filterType === 'studios'}
          name={t('Studio Projects')}
          onClick={() => setFilterType('studios')}
          endIcon={
            <span className="code-s text-label-control rounded bg-studio px-1 h-4.5 flex-shrink-0 flex-grow-0">
              New
            </span>
          }
        />
      </div>
    </div>
  );
};

export default memo(HomeSubheader);
