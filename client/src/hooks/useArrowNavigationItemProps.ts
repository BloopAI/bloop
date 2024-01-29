import React, { useCallback, useContext, useEffect, useRef } from 'react';
import { ArrowNavigationContext } from '../context/arrowNavigationContext';
import { UIContext } from '../context/uiContext';
import { CommandBarContext } from '../context/commandBarContext';
import { useEnterKey } from './useEnterKey';

export const useArrowNavigationItemProps = <T extends HTMLElement>(
  index: string,
  onClick: () => void,
) => {
  const { setFocusedIndex, focusedIndex } = useContext(ArrowNavigationContext);
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const { isVisible: isCommandBarVisible } = useContext(
    CommandBarContext.General,
  );
  const ref = useRef<T>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.movementX || e.movementY) {
        setFocusedIndex(index);
      }
    },
    [index, setFocusedIndex],
  );
  useEffect(() => {
    if (focusedIndex === index) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, index]);

  useEnterKey(
    onClick,
    focusedIndex !== index || !isLeftSidebarFocused || isCommandBarVisible,
  );

  return {
    props: {
      'data-node-index': index,
      onMouseMove: handleMouseMove,
      onClick,
      ref,
    },
    isFocused: isLeftSidebarFocused && focusedIndex === index,
    isLeftSidebarFocused,
    focusedIndex,
  };
};
