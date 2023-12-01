import React, { memo } from 'react';
import useResizeableWidth from '../../hooks/useResizeableWidth';
import NavPanel from './NavPanel';

type Props = {};

const LeftSidebar = ({}: Props) => {
  const { panelRef, dividerRef } = useResizeableWidth(
    true,
    'left_nav_width',
    20,
    40,
  );
  return (
    <div className="h-full relative z-10" ref={panelRef}>
      <NavPanel />
      <div
        ref={dividerRef}
        className="absolute top-0 right-0 transform group translate-x-1/2 w-2.5 h-full bottom-0 cursor-col-resize flex-shrink-0 z-10"
      >
        <div className="mx-auto w-0.5 h-full bg-bg-border group-hover:bg-brand-default" />
      </div>
    </div>
  );
};

export default memo(LeftSidebar);
