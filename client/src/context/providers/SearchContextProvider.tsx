import React, {
  memo,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { FilterType, RepoTabType } from '../../types/general';
import { SearchContext } from '../searchContext';
import { TabsContext } from '../tabsContext';

type Props = {
  tab: RepoTabType;
};

export const SearchContextProvider = memo(
  ({ children, tab }: PropsWithChildren<Props>) => {
    const [inputValue, setInputValue] = useState('');
    const [filters, setFilters] = useState<FilterType[]>([]);
    const [globalRegex, setGlobalRegex] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<string | null>(
      tab.branch || null,
    );
    const { updateTabBranch } = useContext(TabsContext);

    useEffect(() => {
      updateTabBranch(tab.key, selectedBranch);
    }, [selectedBranch, tab.key]);

    const inputContextValue = useMemo(
      () => ({
        inputValue,
        setInputValue,
      }),
      [inputValue],
    );
    const filtersContextValue = useMemo(
      () => ({
        filters,
        setFilters,
      }),
      [filters],
    );
    const regexContextValue = useMemo(
      () => ({
        globalRegex,
        setGlobalRegex,
      }),
      [globalRegex],
    );
    const branchContextValue = useMemo(
      () => ({
        selectedBranch,
        setSelectedBranch,
      }),
      [selectedBranch],
    );
    return (
      <SearchContext.InputValue.Provider value={inputContextValue}>
        <SearchContext.Filters.Provider value={filtersContextValue}>
          <SearchContext.RegexEnabled.Provider value={regexContextValue}>
            <SearchContext.SelectedBranch.Provider value={branchContextValue}>
              {children}
            </SearchContext.SelectedBranch.Provider>
          </SearchContext.RegexEnabled.Provider>
        </SearchContext.Filters.Provider>
      </SearchContext.InputValue.Provider>
    );
  },
);

SearchContextProvider.displayName = 'SearchContextProvider';
