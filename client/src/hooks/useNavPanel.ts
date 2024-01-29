import React, {
  Dispatch,
  MouseEvent,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { UIContext } from '../context/uiContext';
import { CommandBarContext } from '../context/commandBarContext';
import { useEnterKey } from './useEnterKey';

export const useNavPanel = (
  index: string,
  setExpanded: Dispatch<SetStateAction<string>>,
  isExpanded: boolean,
  focusedIndex: string,
  setFocusedIndex: (s: string) => void,
) => {
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const { isVisible: isCommandBarVisible } = useContext(
    CommandBarContext.General,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => (prev === index ? '' : index));
  }, [index]);

  useEffect(() => {
    if (isExpanded) {
      // containerRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isExpanded]);

  const noPropagate = useCallback((e?: MouseEvent) => {
    e?.stopPropagation();
  }, []);

  useEffect(() => {
    if (focusedIndex === index && containerRef.current) {
      containerRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, index]);

  useEnterKey(
    toggleExpanded,
    focusedIndex !== index || !isLeftSidebarFocused || isCommandBarVisible,
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.movementX || e.movementY) {
        setFocusedIndex(index);
      }
    },
    [index, setFocusedIndex],
  );

  return {
    toggleExpanded,
    noPropagate,
    containerRef,
    isLeftSidebarFocused,
    isCommandBarVisible,
    handleMouseMove,
  };
};
