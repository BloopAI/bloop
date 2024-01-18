import { useCallback } from 'react';
import useKeyboardNavigation from './useKeyboardNavigation';

export const useEnterKey = (handleKey: () => void, isDisabled?: boolean) => {
  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleKey();
      }
    },
    [handleKey],
  );
  useKeyboardNavigation(handleKeyEvent, isDisabled);
};
