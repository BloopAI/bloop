import React, { useContext, useMemo } from 'react';
import SearchInput from '../SearchInput';
import { AppNavigationContext } from '../../context/appNavigationContext';
import { splitPath } from '../../utils';
import Breadcrumbs from '../Breadcrumbs';
import { RepositoriesContext } from '../../context/repositoriesContext';
import { UIContext } from '../../context/uiContext';
import { DropdownNormal } from '../Dropdown';
import { MenuItemType } from '../../types/general';
import { indexRepoBranch } from '../../services/api';
import { SearchContext } from '../../context/searchContext';

const Subheader = () => {
  const { navigationHistory, navigateBack } = useContext(AppNavigationContext);
  const { tab } = useContext(UIContext);
  const { repositories } = useContext(RepositoriesContext);
  const { selectedBranch, setSelectedBranch } = useContext(SearchContext);

  const allBranches = useMemo(() => {
    return repositories?.find((r) => r.ref === tab.key)?.branches || [];
  }, [repositories, tab.key]);

  const indexedBranches = useMemo(() => {
    return (
      repositories?.find((r) => r.ref === tab.key)?.branch_filter?.select || []
    );
  }, [repositories, tab.key]);

  const breadcrumbs = useMemo(() => {
    const reversedHistory = [...navigationHistory].reverse();
    const lastHomeIndex = reversedHistory.findIndex(
      (n) => n.type === 'repo' && !n.path,
    );
    let historyPart = navigationHistory;
    if (lastHomeIndex >= 0) {
      historyPart = reversedHistory.slice(0, lastHomeIndex + 1).reverse();
    }
    if (historyPart.length === 1 && historyPart[0].type === 'repo') {
      return [];
    }
    let resultsInList: boolean;
    return historyPart
      .map((item, i) => {
        const onClick = () => navigateBack(-(historyPart.length - 1 - i));
        if (item.type === 'repo' && !item.path) {
          return {
            label: item.repo!,
            onClick,
          };
        }
        if (
          (item.type === 'repo' || item.type === 'full-result') &&
          item.path
        ) {
          const label = splitPath(item.path);
          return {
            label: label[label.length - 1] || label[label.length - 2],
            onClick,
          };
        }
        if (item.type === 'conversation-result') {
          return {
            label: 'Results',
            onClick,
          };
        }
      })
      .reverse()
      .filter((i): i is { label: string; onClick: () => void } => {
        if (i?.label === 'Results') {
          if (resultsInList) {
            return false; // remove clusters of Results
          }
          resultsInList = true;
        } else {
          resultsInList = false;
        }
        return !!i;
      })
      .reverse();
  }, [navigationHistory]);

  return (
    <div className="w-full bg-bg-shade py-2 pl-8 pr-6 flex items-center justify-between border-b border-bg-border shadow-medium relative z-40">
      <div className="flex flex-grow flex-col gap-3 justify-center overflow-hidden">
        <Breadcrumbs
          pathParts={breadcrumbs}
          path={''}
          separator="›"
          type="button"
        />
      </div>
      <div className="w-full max-w-[548px] flex-grow-[3]">
        <SearchInput />
      </div>
      <div className="flex-grow flex items-center justify-end max-w-[25%]">
        {allBranches.length > 1 && (
          <DropdownNormal
            items={[
              { type: MenuItemType.DEFAULT, text: 'All branches' },
            ].concat(
              allBranches.map((b) => ({
                type: MenuItemType.DEFAULT,
                text: b,
                onClick: () => {
                  setSelectedBranch(b);
                  if (!indexedBranches.includes(b)) {
                    indexRepoBranch(tab.key, b);
                  }
                },
              })),
            )}
            btnClassName="w-full ellipsis"
            titleClassName="ellipsis"
            selected={{
              type: MenuItemType.DEFAULT,
              text: selectedBranch || 'All branches',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Subheader;
