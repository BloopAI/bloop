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

    const WrappedChildren = useMemo(() => {
      return tab.type === TabType.REPO ? (
        <UIContext.Tab.Provider value={{ tab }}>
          {children}
        </UIContext.Tab.Provider>
      ) : (
        children
      );
    }, [tab]);

    return (
      <UIContext.Symbols.Provider value={symbolsContextValue}>
        <UIContext.RightPanel.Provider value={rightPanelContextValue}>
          <UIContext.Filters.Provider value={filtersContextValue}>
            {WrappedChildren}
          </UIContext.Filters.Provider>
        </UIContext.RightPanel.Provider>
      </UIContext.Symbols.Provider>
    );
  },
);

TabUiContextProvider.displayName = 'UIContextProvider';
