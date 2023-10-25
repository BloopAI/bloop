import { memo, PropsWithChildren, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { DeviceContext, DeviceContextType } from '../deviceContext';
import { initializeSentry } from '../../utils/services';

type Props = {
  deviceContextValue: DeviceContextType;
};

export const DeviceContextProvider = memo(
  ({ children, deviceContextValue }: PropsWithChildren<Props>) => {
    useEffect(() => {
      if (deviceContextValue.envConfig.sentry_dsn_fe) {
        initializeSentry(
          deviceContextValue.envConfig,
          deviceContextValue.release,
        );
      } else {
        const client = Sentry.getCurrentHub().getClient();
        if (client) {
          client.close();
        }
      }
    }, [deviceContextValue.envConfig.sentry_dsn_fe]);

    return (
      <DeviceContext.Provider value={deviceContextValue}>
        {children}
      </DeviceContext.Provider>
    );
  },
);

DeviceContextProvider.displayName = 'DeviceContextProvider';
