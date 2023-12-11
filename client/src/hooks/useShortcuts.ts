import { useContext, useMemo } from 'react';
import { DeviceContext } from '../context/deviceContext';
import { mapShortcuts } from '../utils/keyboardUtils';

const useShortcuts = (shortcut?: string[]) => {
  const { os } = useContext(DeviceContext);

  const shortcutKeys = useMemo(() => {
    return mapShortcuts(shortcut, os.type);
  }, [os, shortcut]);

  return shortcutKeys;
};

export default useShortcuts;
