import { memo, useContext } from 'react';
import { ToastsContext } from '../context/toastsContext';
import Toast from './Toast';

type Props = {};

const Toaster = ({}: Props) => {
  const { toasts } = useContext(ToastsContext.Values);

  return !toasts.length ? null : (
    <div className="fixed right-4 bottom-10 z-60 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </div>
  );
};

export default memo(Toaster);
