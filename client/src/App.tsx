import React, { memo } from 'react';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import { PersonalQuotaContextProvider } from './context/providers/PersonalQuotaContextProvider';
import ReportBugModal from './components/ReportBugModal';
import Onboarding from './Onboarding';
import Header from './components/Header';
import Project from './Project';
import CommandBar from './CommandBar';
import ProjectContextProvider from './context/providers/ProjectContextProvider';
import CommandBarContextProvider from './context/providers/CommandBarContextProvider';

const App = () => {
  return (
    <AnalyticsContextProvider>
      <PersonalQuotaContextProvider>
        <ProjectContextProvider>
          <ReportBugModal />
          <Onboarding />
          <CommandBarContextProvider>
            <Header />
            <CommandBar />
            <Project />
          </CommandBarContextProvider>
        </ProjectContextProvider>
      </PersonalQuotaContextProvider>
    </AnalyticsContextProvider>
  );
};

export default memo(App);
