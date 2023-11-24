import React, { memo } from 'react';
import IdeNavigation from '../IdeNavigation';
import useResizeableWidth from '../../../hooks/useResizeableWidth';

const LeftSidebar = () => {
  const { panelRef, dividerRef } = useResizeableWidth(
    true,
    'left_nav_width',
    25,
    40,
  );
  return (
    <div className="h-full relative z-10" ref={panelRef}>
      <div className="h-full overflow-auto flex flex-col">
        <IdeNavigation />
      </div>
      <div
        ref={dividerRef}
        className="absolute top-0 right-0 transform group w-2.5 bottom-0 cursor-col-resize flex-shrink-0 z-10"
      >
        <div className="ml-auto w-0.5 h-full bg-chat-bg-border group-hover:bg-bg-main" />
      </div>
    </div>
  );
};

export default memo(LeftSidebar);
