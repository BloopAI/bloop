import { PropsWithChildren, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { DeviceContext, DeviceContextType } from '../deviceContext';
import { initializeSentry } from '../../utils/services';

type Props = {
  deviceContextValue: DeviceContextType;
};

export const DeviceContextProvider = ({
  children,
  deviceContextValue,
}: PropsWithChildren<Props>) => {
  useEffect(() => {
    deviceContextValue.invokeTauriCommand('enable_telemetry');
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
  }, [
    deviceContextValue.invokeTauriCommand,
    deviceContextValue.envConfig.sentry_dsn_fe,
  ]);

  return (
    <DeviceContext.Provider value={deviceContextValue}>
      {children}
    </DeviceContext.Provider>
  );
};
