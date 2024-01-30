import React, {
  memo,
  useCallback,
  useContext,
  MouseEvent,
  useMemo,
} from 'react';
import useResizeableWidth from '../../hooks/useResizeableWidth';
import { LEFT_SIDEBAR_WIDTH_KEY } from '../../services/storage';
import ProjectsDropdown from '../../components/Header/ProjectsDropdown';
import { ChevronDownIcon } from '../../icons';
import Dropdown from '../../components/Dropdown';
import { DeviceContext } from '../../context/deviceContext';
import { ProjectContext } from '../../context/projectContext';
import { UIContext } from '../../context/uiContext';
import { checkEventKeys } from '../../utils/keyboardUtils';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import { CommandBarContext } from '../../context/commandBarContext';
import UsagePopover from '../../components/UsagePopover';
import { useArrowNavigation } from '../../hooks/useArrowNavigation';
import { ArrowNavigationContext } from '../../context/arrowNavigationContext';
import { noOp } from '../../utils';
import RegexSearchPanel from './RegexSearchPanel';
import NavPanel from './NavPanel';

type Props = {};

const LeftSidebar = ({}: Props) => {
  const { os } = useContext(DeviceContext);
  const { project } = useContext(ProjectContext.Current);
  const { isRegexSearchEnabled } = useContext(ProjectContext.RegexSearch);
  const { setIsLeftSidebarFocused, isLeftSidebarFocused } = useContext(
    UIContext.Focus,
  );
  const { isVisible: isCommandBarVisible } = useContext(
    CommandBarContext.General,
  );
  const { focusedIndex, setFocusedIndex, handleArrowKey, navContainerRef } =
    useArrowNavigation();

  const { panelRef, dividerRef } = useResizeableWidth(
    true,
    LEFT_SIDEBAR_WIDTH_KEY,
    20,
    40,
  );

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, ['cmd', '0'])) {
        e.preventDefault();
        e.stopPropagation();
        setIsLeftSidebarFocused(true);
      }
      if (isLeftSidebarFocused) {
        handleArrowKey(e);
      }
    },
    [isLeftSidebarFocused, handleArrowKey],
  );
  useKeyboardNavigation(handleKeyEvent, isCommandBarVisible);

  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setIsLeftSidebarFocused(true);
  }, []);

  const contextValue = useMemo(
    () => ({
      focusedIndex,
      setFocusedIndex,
      handleClose: noOp,
    }),
    [focusedIndex],
  );

  return (
    <div
      className="h-full relative z-10 min-w-[204px] flex-shrink-0 overflow-hidden flex flex-col"
      ref={panelRef}
    >
      <div className="w-ful flex gap-4 hover:bg-bg-base-hover border-b border-bg-border h-10 overflow-hidden">
        {os.type === 'Darwin' ? <span className="w-16 flex-shrink-0" /> : ''}
        <Dropdown
          DropdownComponent={ProjectsDropdown}
          dropdownPlacement="bottom-start"
          containerClassName="flex-1 overflow-hidden"
          appendTo={document.body}
        >
          <div className="flex-1 flex px-4 items-center text-left h-10 gap-4 border-r border-bg-border overflow-hidden">
            <p className="flex-1 body-s-b ellipsis">
              {project?.name || 'Default project'}
            </p>
            <ChevronDownIcon raw sizeClassName="w-3.5 h-3.5" />
          </div>
        </Dropdown>
      </div>
      <div
        onClick={handleClick}
        className="flex-1 overflow-auto"
        ref={navContainerRef}
      >
        <ArrowNavigationContext.Provider value={contextValue}>
          <RegexSearchPanel
            projectId={project?.id}
            isRegexEnabled={isRegexSearchEnabled}
          />
          {!isRegexSearchEnabled && <NavPanel />}
        </ArrowNavigationContext.Provider>
      </div>
      <UsagePopover />
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
