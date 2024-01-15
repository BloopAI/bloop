import React, { memo } from 'react';
import useResizeableWidth from '../hooks/useResizeableWidth';
import { RIGHT_SIDEBAR_WIDTH_KEY } from '../services/storage';
import { TabType } from '../types/general';
import CurrentTabContent from './CurrentTabContent';

type Props = {
  onDropToRight: (tab: TabType) => void;
  moveToAnotherSide: (tab: TabType) => void;
};

const RightTab = ({ onDropToRight, moveToAnotherSide }: Props) => {
  const { panelRef, dividerRef } = useResizeableWidth(
    false,
    RIGHT_SIDEBAR_WIDTH_KEY,
    40,
    60,
    15,
  );

  return (
    <div ref={panelRef} className="overflow-hidden relative flex-shrink-0">
      <div
        ref={dividerRef}
        className="absolute top-0 left-0 transform group -translate-x-1/2 w-2.5 h-full bottom-0 cursor-col-resize flex-shrink-0 z-10"
      >
        <div className="mx-auto w-0.5 h-full bg-bg-border group-hover:bg-brand-default" />
      </div>
      <CurrentTabContent
        side="right"
        onDrop={onDropToRight}
        moveToAnotherSide={moveToAnotherSide}
      />
    </div>
  );
};

export default memo(RightTab);
