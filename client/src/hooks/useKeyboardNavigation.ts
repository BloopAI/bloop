import { useEffect } from 'react';

const useKeyboardNavigation = (
  handleKeyEvent: (e: KeyboardEvent) => void,
  disabled?: boolean,
) => {
  useEffect(() => {
    if (!disabled) {
      window.addEventListener('keydown', handleKeyEvent);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyEvent);
    };
  }, [handleKeyEvent, disabled]);
};

export default useKeyboardNavigation;
