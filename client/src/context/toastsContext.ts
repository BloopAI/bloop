import { createContext } from 'react';
import { ToastType } from '../types/general';

export const ToastsContext = {
  Values: createContext({
    toasts: [] as ToastType[],
  }),
  Handlers: createContext({
    addToast: (t: Omit<ToastType, 'id'>) => {},
    closeToast: (id: string) => {},
  }),
};
