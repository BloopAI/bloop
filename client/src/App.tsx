import React, { memo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toaster } from 'sonner';
import ReportBugModal from './components/ReportBugModal';
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

const toastOptions = {
  unStyled: true,
  classNames: {
    toast:
      'w-[20.75rem] p-4 pl-5 grid grid-cols-[1rem_1fr] items-start gap-3 rounded-md border border-bg-border bg-bg-base shadow-high',
    error: 'text-red',
    info: 'text-label-title',
    title: 'body-s-b',
    description: '!text-label-muted body-s mt-1.5',
    actionButton: 'col-span-full',
    cancelButton: 'bg-orange-400',
    closeButton:
      '!bg-bg-base !text-label-muted !border-none !left-[unset] !right-2 !top-6 !w-6 !h-6',
  },
};

const App = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <UIContextProvider>
        <ProjectContextProvider>
          <Toaster closeButton toastOptions={toastOptions} />
          <RepositoriesContextProvider>
            <ReportBugModal />
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
    </DndProvider>
  );
};

export default memo(App);
