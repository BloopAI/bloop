import React, { useEffect, useState } from 'react';
import { getJsonFromStorage, saveJsonToStorage } from '../services/storage';

export const usePersistentState = <T,>(
  defaultValue: T,
  key: string,
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    const storedValue = getJsonFromStorage<T>(key);

    return storedValue !== null ? storedValue : defaultValue;
  });
  useEffect(() => {
    saveJsonToStorage(key, value);
  }, [key, value]);
  return [value, setValue];
};
