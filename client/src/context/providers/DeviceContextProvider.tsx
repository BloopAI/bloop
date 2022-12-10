import { PropsWithChildren, useContext, useEffect } from 'react';
import { DeviceContext, DeviceContextType } from '../deviceContext';
import { AnalyticsContext } from '../analyticsContext';
import { telemetryAllowed } from '../../utils/services';

type Props = {
  deviceContextValue: DeviceContextType;
};

export const DeviceContextProvider = ({
  children,
  deviceContextValue,
}: PropsWithChildren<Props>) => {
  const { isAnalyticsAllowed } = useContext(AnalyticsContext);

  useEffect(() => {
    deviceContextValue.invokeTauriCommand(
      isAnalyticsAllowed ? 'enable_telemetry' : 'disable_telemetry',
    );
    telemetryAllowed.value = isAnalyticsAllowed;
  }, [isAnalyticsAllowed, deviceContextValue.invokeTauriCommand]);

  return (
    <DeviceContext.Provider value={deviceContextValue}>
      {children}
    </DeviceContext.Provider>
  );
};
