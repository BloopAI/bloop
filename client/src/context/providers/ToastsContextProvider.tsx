import { memo, PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { ToastsContext } from '../toastsContext';
import { ToastType } from '../../types/general';

type Props = {};

const ToastsContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const addToast = useCallback((toast: Omit<ToastType, 'id'>) => {
    setToasts((prev) => [...prev, { ...toast, id: Date.now().toString() }]);
  }, []);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const valuesContext = useMemo(
    () => ({
      toasts,
    }),
    [toasts],
  );

  const handlersContext = useMemo(
    () => ({
      addToast,
      closeToast,
    }),
    [addToast, closeToast],
  );

  return (
    <ToastsContext.Handlers.Provider value={handlersContext}>
      <ToastsContext.Values.Provider value={valuesContext}>
        {children}
      </ToastsContext.Values.Provider>
    </ToastsContext.Handlers.Provider>
  );
};

export default memo(ToastsContextProvider);
