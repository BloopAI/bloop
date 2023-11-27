import React, { memo } from 'react';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import { PersonalQuotaContextProvider } from './context/providers/PersonalQuotaContextProvider';
import ReportBugModal from './components/ReportBugModal';
import Onboarding from './Onboarding';
import Header from './components/Header';
import Project from './Project';

const App = () => {
  return (
    <AnalyticsContextProvider>
      <PersonalQuotaContextProvider>
        <ReportBugModal />
        <Onboarding />
        <Header />
        <Project />
      </PersonalQuotaContextProvider>
    </AnalyticsContextProvider>
  );
};

export default memo(App);
