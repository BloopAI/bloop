import React, { memo } from 'react';
import { RenderPage } from '../../pages/RepoTab/Content';
import IdeNavigation from '../IdeNavigation';
import Filters from '../Filters';
import useResizeableWidth from '../../hooks/useResizeableWidth';
import { LEFT_SIDEBAR_WIDTH_KEY } from '../../services/storage';

type Props = {
  renderPage: RenderPage;
};

const LeftSidebar = ({ renderPage }: Props) => {
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
