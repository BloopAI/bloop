import React, {
  memo,
  useCallback,
  useContext,
  MouseEvent,
  useRef,
  useState,
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
  const ref = useRef<HTMLDivElement>(null);
  const [focusedIndexFull, setFocusedIndexFull] = useState('');

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
        if (ref.current) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            // eslint-disable-next-line no-undef
            const nodes: NodeListOf<HTMLElement> =
              ref.current.querySelectorAll('[data-node-index]');
            setFocusedIndexFull((prev) => {
              const prevIndex = Array.from(nodes).findIndex(
                (n) => n.dataset.nodeIndex === prev,
              );
              if (prevIndex > -1) {
                const newIndex =
                  e.key === 'ArrowDown'
                    ? prevIndex < nodes.length - 1
                      ? prevIndex + 1
                      : 0
                    : prevIndex > 0
                    ? prevIndex - 1
                    : nodes.length - 1;
                return nodes[newIndex]?.dataset?.nodeIndex || '';
              }
              return nodes[0]?.dataset?.nodeIndex || '';
            });
          }
        }
      }
    },
    [isLeftSidebarFocused],
  );
  useKeyboardNavigation(handleKeyEvent, isCommandBarVisible);

  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setIsLeftSidebarFocused(true);
  }, []);

  return (
    <div
      className="h-full relative z-10 min-w-[204px] flex-shrink-0 overflow-hidden flex flex-col"
      ref={panelRef}
    >
      <div className="w-ful flex gap-4 hover:bg-bg-base-hover border-b border-bg-border h-10">
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
      <div onClick={handleClick} className="flex-1 overflow-auto" ref={ref}>
        <RegexSearchPanel
          projectId={project?.id}
          isRegexEnabled={isRegexSearchEnabled}
          focusedIndex={focusedIndexFull}
          setFocusedIndex={setFocusedIndexFull}
        />
        {!isRegexSearchEnabled && (
          <NavPanel
            focusedIndex={focusedIndexFull}
            setFocusedIndex={setFocusedIndexFull}
          />
        )}
      </div>
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
