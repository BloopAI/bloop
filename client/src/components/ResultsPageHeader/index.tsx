import React, { useContext } from 'react';
import { Collapsed, Expanded } from '../../icons';
import { MenuListItemType } from '../ContextMenu';
import Tabs from '../../components/Tabs';
import SkeletonItem from '../../components/SkeletonItem';
import { UIContext } from '../../context/uiContext';

type Props = {
  resultsNumber: number;
  showCollapseControls?: boolean;
  collapsed?: boolean;
  loading?: boolean;
};

const dropdownItems = [
  {
    text: 'Best match',
    type: MenuListItemType.DEFAULT,
  },
  {
    text: 'Last indexed',
    type: MenuListItemType.DEFAULT,
  },
  {
    text: 'Frequency',
    type: MenuListItemType.DEFAULT,
  },
];

const PageHeader = ({
  resultsNumber,
  showCollapseControls,
  loading,
}: Props) => {
  const { symbolsCollapsed, setSymbolsCollapsed } = useContext(UIContext);
  return (
    <div className="w-full flex justify-between items-center mb-5 select-none">
      <div>
        {loading ? (
          <div className="h-6 w-24 mb-2">
            <SkeletonItem />
          </div>
        ) : (
          <h4>{resultsNumber ? 'Results' : 'No results'}</h4>
        )}
        {loading ? (
          <div className="h-4 w-48">
            <SkeletonItem />
          </div>
        ) : (
          <p className="body-s text-gray-500">
            {resultsNumber
              ? `Showing ${resultsNumber} result${resultsNumber > 1 ? 's' : ''}`
              : 'Nothing matched your search. Try a different combination!'}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        {showCollapseControls ? (
          <span>
            <Tabs
              tabs={[{ iconLeft: <Expanded /> }, { iconLeft: <Collapsed /> }]}
              activeTab={symbolsCollapsed ? 1 : 0}
              onTabChange={(t) => {
                setSymbolsCollapsed(t === 1);
              }}
              size="small"
              variant="button"
            />
          </span>
        ) : (
          ''
        )}
        {/*<Dropdown items={dropdownItems} btnHint="Sort by:" />*/}
      </div>
    </div>
  );
};

export default PageHeader;
