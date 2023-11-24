import React, { memo } from 'react';
import { DeviceContextType } from './context/deviceContext';
import { DeviceContextProvider } from './context/providers/DeviceContextProvider';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import { PersonalQuotaContextProvider } from './context/providers/PersonalQuotaContextProvider';
import ReportBugModal from './components/ReportBugModal';
import Onboarding from './Onboarding';
import WaitingUpgradePopup from './components/UpgradePopup/WaitingUpgradePopup';
import Header from './components/Header';
import { EnvContextType } from './context/envContext';

const App = () => {
  return (
    <AnalyticsContextProvider>
      <PersonalQuotaContextProvider>
        <ReportBugModal />
        <Onboarding />
        <WaitingUpgradePopup />
        <Header />
        <div>
          <div>Hello world</div>
        </div>
      </PersonalQuotaContextProvider>
    </AnalyticsContextProvider>
  );
};

export default memo(App);
