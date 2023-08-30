import React, { memo, PropsWithChildren, useMemo, useState } from 'react';
import { UIContext } from '../uiContext';
import { HomeTabType, RepoTabType, TabType } from '../../types/general';

export const TabUiContextProvider = memo(
  ({
    children,
    tab,
  }: PropsWithChildren<{ tab: RepoTabType | HomeTabType }>) => {
    const [symbolsCollapsed, setSymbolsCollapsed] = useState(true);
    const [isRightPanelOpen, setRightPanelOpen] = useState(false);
    const [isFiltersOpen, setFiltersOpen] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'repos' | 'studios'>(
      'all',
    );

    const symbolsContextValue = useMemo(
      () => ({
        symbolsCollapsed,
        setSymbolsCollapsed,
      }),
      [symbolsCollapsed],
    );

    const rightPanelContextValue = useMemo(
      () => ({
        isRightPanelOpen,
        setRightPanelOpen,
      }),
      [isRightPanelOpen],
    );

    const filtersContextValue = useMemo(
      () => ({
        isFiltersOpen,
        setFiltersOpen,
      }),
      [isFiltersOpen],
    );

    const homeContextValue = useMemo(
      () => ({
        search,
        setSearch,
        filterType,
        setFilterType,
      }),
      [search, filterType],
    );

    const WrappedChildren = useMemo(() => {
      return tab.type === TabType.REPO ? (
        <UIContext.Tab.Provider value={{ tab }}>
          {children}
        </UIContext.Tab.Provider>
      ) : (
        children
      );
    }, [tab, children]);

    return (
      <UIContext.Symbols.Provider value={symbolsContextValue}>
        <UIContext.RightPanel.Provider value={rightPanelContextValue}>
          <UIContext.Filters.Provider value={filtersContextValue}>
            <UIContext.HomeScreen.Provider value={homeContextValue}>
              {WrappedChildren}
            </UIContext.HomeScreen.Provider>
          </UIContext.Filters.Provider>
        </UIContext.RightPanel.Provider>
      </UIContext.Symbols.Provider>
    );
  },
);

TabUiContextProvider.displayName = 'UIContextProvider';
