import { memo, PropsWithChildren, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { DeviceContext, DeviceContextType } from '../deviceContext';
import { initializeSentry } from '../../utils/services';
import { EnvConfig } from '../../types/general';

type Props = {
  deviceContextValue: DeviceContextType;
  envConfig: EnvConfig;
};

export const DeviceContextProvider = memo(
  ({ children, deviceContextValue, envConfig }: PropsWithChildren<Props>) => {
    useEffect(() => {
      if (envConfig.sentry_dsn_fe) {
        initializeSentry(envConfig, deviceContextValue.release);
      } else {
        const client = Sentry.getCurrentHub().getClient();
        if (client) {
          client.close();
        }
      }
    }, [envConfig.sentry_dsn_fe]);

    return (
      <DeviceContext.Provider value={deviceContextValue}>
        {children}
      </DeviceContext.Provider>
    );
  },
);

DeviceContextProvider.displayName = 'DeviceContextProvider';
