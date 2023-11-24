import React from 'react';

import SkeletonItem from './index';

export default {
  title: 'components/SkeletonItem',
  component: SkeletonItem,
};

export const Default = () => {
  return (
    <div
      style={{ width: '100%', backgroundColor: '' }}
      className="flex flex-row gap-4"
    >
      <div className="w-56 h-4">
        <SkeletonItem />
      </div>
    </div>
  );
};
