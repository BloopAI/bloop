import React, { useContext, useState } from 'react';
import { Collapsed, Expanded } from '../../icons';
import { MenuListItemType } from '../../components/ContextMenu';
import Tabs from '../../components/Tabs';
import SkeletonItem from '../../components/SkeletonItem';
import { UIContext } from '../../context/uiContext';

type Props = {
  resultsNumber: number;
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

const PageHeader = ({ resultsNumber, loading }: Props) => {
  return (
    <div className="w-full flex justify-between items-center mb-5 select-none">
      <div>
        {loading ? (
          <div className="h-6 w-24 mb-2">
            <SkeletonItem />
          </div>
        ) : (
          <h4>{resultsNumber ? 'Answer' : 'No results'}</h4>
        )}
        {loading ? (
          <div className="h-4 w-48">
            <SkeletonItem />
          </div>
        ) : (
          ''
        )}
      </div>
    </div>
  );
};

export default PageHeader;
