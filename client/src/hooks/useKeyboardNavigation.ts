import { useEffect } from 'react';

const useKeyboardNavigation = (handleKeyEvent: (e: KeyboardEvent) => void) => {
  useEffect(() => {
    window.addEventListener('keydown', handleKeyEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyEvent);
    };
  }, [handleKeyEvent]);
};

export default useKeyboardNavigation;
