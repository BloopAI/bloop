import { memo, PropsWithChildren } from 'react';
import { DeviceContext, DeviceContextType } from '../deviceContext';

type Props = {
  deviceContextValue: DeviceContextType;
};

export const DeviceContextProvider = memo(
  ({ children, deviceContextValue }: PropsWithChildren<Props>) => {
    return (
      <DeviceContext.Provider value={deviceContextValue}>
        {children}
      </DeviceContext.Provider>
    );
  },
);

DeviceContextProvider.displayName = 'DeviceContextProvider';
