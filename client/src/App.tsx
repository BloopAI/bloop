import React, { useState, memo, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import * as Sentry from '@sentry/react';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toaster } from 'sonner';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import { PersonalQuotaContextProvider } from './context/providers/PersonalQuotaContextProvider';
import ReportBugModal from './components/ReportBugModal';
import Onboarding from './Onboarding';
import GithubLogin from './GithubLogin';
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
import ErrorFallback from './components/ErrorFallback';
import useStateRef from './hooks/useStateRef';
import LoginStore from './GithubLogin/loginStore';

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

  const [isLoggedIn, setIsLoggedIn] = useStateRef(false); // 新增的状态

  useEffect(() => {
    // window.addEventListener('login', (data) => {
    //   console.log('login', data)
    // }, false)
  console.log('登录状态更新了',LoginStore.getLoginStatus())
    setIsLoggedIn(LoginStore.getLoginStatus())
  },[LoginStore.isLogin])
  return (
    <DndProvider backend={HTML5Backend}>
      <AnalyticsContextProvider>
        <PersonalQuotaContextProvider>
          <UIContextProvider>
            <ProjectContextProvider>
              <Toaster closeButton toastOptions={toastOptions} />
              <RepositoriesContextProvider>
                <ReportBugModal />
                {!isLoggedIn && <GithubLogin />}
                <UpgradeRequiredPopup />
                <CommandBarContextProvider>
                  <Settings />
                  <ProjectSettings />
                  <FileHighlightsContextProvider>
                    <TabsContextProvider>
                      {isLoggedIn &&<CommandBar />}
                      {isLoggedIn &&<Project />}
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

export default memo(
  Sentry.withErrorBoundary(App, {
    fallback: (props) => <ErrorFallback {...props} />,
  }),
);
