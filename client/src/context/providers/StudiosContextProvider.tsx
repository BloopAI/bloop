import { memo, PropsWithChildren, useMemo, useState } from 'react';
import { StudiosContext, StudioContext } from '../studiosContext';

type Props = {};

const StudiosContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const [studios, setStudios] = useState<Record<string, StudioContext>>({});

  const contextValue = useMemo(
    () => ({
      studios,
      setStudios,
    }),
    [studios],
  );
  return (
    <StudiosContext.Provider value={contextValue}>
      {children}
    </StudiosContext.Provider>
  );
};

export default memo(StudiosContextProvider);
