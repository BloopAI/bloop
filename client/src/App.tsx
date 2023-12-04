import React, { memo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import { PersonalQuotaContextProvider } from './context/providers/PersonalQuotaContextProvider';
import ReportBugModal from './components/ReportBugModal';
import Onboarding from './Onboarding';
import Project from './Project';
import CommandBar from './CommandBar';
import ProjectContextProvider from './context/providers/ProjectContextProvider';
import CommandBarContextProvider from './context/providers/CommandBarContextProvider';
import { UIContextProvider } from './context/providers/UIContextProvider';
import Settings from './Settings';
import ProjectSettings from './ProjectSettings';
import TabsContextProvider from './context/providers/TabsContextProvider';

const App = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <AnalyticsContextProvider>
        <PersonalQuotaContextProvider>
          <ProjectContextProvider>
            <UIContextProvider>
              <ReportBugModal />
              <Onboarding />
              <CommandBarContextProvider>
                <Settings />
                <ProjectSettings />
                <CommandBar />
                <TabsContextProvider>
                  <Project />
                </TabsContextProvider>
              </CommandBarContextProvider>
            </UIContextProvider>
          </ProjectContextProvider>
        </PersonalQuotaContextProvider>
      </AnalyticsContextProvider>
    </DndProvider>
  );
};

export default memo(App);
