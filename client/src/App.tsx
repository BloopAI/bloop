import React, { memo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toaster } from 'sonner';
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
import { FileHighlightsContextProvider } from './context/providers/FileHighlightsContextProvider';
import RepositoriesContextProvider from './context/providers/RepositoriesContextProvider';
import UpgradeRequiredPopup from './components/UpgradeRequiredPopup';

const toastOptions = {
  unStyled: true,
  classNames: {
    toast:
      'w-[20.75rem] p-4 pl-5 flex items-start gap-3 rounded-md border border-bg-border bg-bg-base shadow-high',
    error: 'text-red',
    info: 'text-label-title',
    title: 'body-s-b',
    description: '!text-label-muted body-s mt-1.5',
    actionButton: 'bg-zinc-400',
    cancelButton: 'bg-orange-400',
    closeButton:
      '!bg-bg-base !text-label-muted !border-none !left-[unset] !right-2 !top-6 !w-6 !h-6',
  },
};

const App = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <AnalyticsContextProvider>
        <PersonalQuotaContextProvider>
          <UIContextProvider>
            <ProjectContextProvider>
              <Toaster closeButton toastOptions={toastOptions} />
              <RepositoriesContextProvider>
                <ReportBugModal />
                <Onboarding />
                <UpgradeRequiredPopup />
                <CommandBarContextProvider>
                  <Settings />
                  <ProjectSettings />
                  <FileHighlightsContextProvider>
                    <TabsContextProvider>
                      <CommandBar />
                      <Project />
                    </TabsContextProvider>
                  </FileHighlightsContextProvider>
                </CommandBarContextProvider>
              </RepositoriesContextProvider>
            </ProjectContextProvider>
          </UIContextProvider>
        </PersonalQuotaContextProvider>
      </AnalyticsContextProvider>
    </DndProvider>
  );
};

export default memo(App);
