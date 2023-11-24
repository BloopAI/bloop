import { useEffect } from 'react';

const useKeyboardNavigation = (
  handleKeyEvent: (e: KeyboardEvent) => void,
  disabled?: boolean,
  onCapture?: boolean,
) => {
  useEffect(() => {
    if (!disabled) {
      window.addEventListener('keydown', handleKeyEvent, onCapture);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyEvent, onCapture);
    };
  }, [handleKeyEvent, disabled, onCapture]);
};

export default useKeyboardNavigation;
