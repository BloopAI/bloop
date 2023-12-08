import React, { memo, useContext } from 'react';
import useResizeableWidth from '../../hooks/useResizeableWidth';
import { LEFT_SIDEBAR_WIDTH_KEY } from '../../services/storage';
import ProjectsDropdown from '../../components/Header/ProjectsDropdown';
import { ChevronDownIcon } from '../../icons';
import Dropdown from '../../components/Dropdown';
import { DeviceContext } from '../../context/deviceContext';
import { ProjectContext } from '../../context/projectContext';
import NavPanel from './NavPanel';
import RegexSearchPanel from './RegexSearchPanel';

type Props = {};

const LeftSidebar = ({}: Props) => {
  const { os } = useContext(DeviceContext);
  const { project } = useContext(ProjectContext.Current);
  const { isRegexSearchEnabled } = useContext(ProjectContext.RegexSearch);
  const { panelRef, dividerRef } = useResizeableWidth(
    true,
    LEFT_SIDEBAR_WIDTH_KEY,
    20,
    40,
  );
  return (
    <div
      className="h-full relative z-10 min-w-[204px] flex-shrink-0 overflow-hidden flex flex-col"
      ref={panelRef}
    >
      <div className="w-ful flex hover:bg-bg-base-hover border-b border-bg-border h-10">
        {os.type === 'Darwin' ? <span className="w-16 flex-shrink-0" /> : ''}
        <Dropdown
          DropdownComponent={ProjectsDropdown}
          dropdownPlacement="bottom-start"
          containerClassName="flex-1"
          appendTo={document.body}
        >
          <div className="flex-1 flex px-4 items-center text-left h-10 gap-4 border-r border-bg-border">
            <p className="flex-1 body-s-b">
              {project?.name || 'Default project'}
            </p>
            <ChevronDownIcon raw sizeClassName="w-3.5 h-3.5" />
          </div>
        </Dropdown>
      </div>
      {isRegexSearchEnabled ? <RegexSearchPanel /> : <NavPanel />}
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
