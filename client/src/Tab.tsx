import React, { PureComponent } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Settings from './components/Settings';
import { UITabType } from './types/general';
import { DeviceContextType } from './context/deviceContext';
import './index.css';
import ReportBugModal from './components/ReportBugModal';
import { UIContextProvider } from './context/providers/UiContextProvider';
import { DeviceContextProvider } from './context/providers/DeviceContextProvider';
import { AppNavigationProvider } from './context/providers/AppNavigationProvider';
import ContentContainer from './pages';
import { SearchContextProvider } from './context/providers/SearchContextProvider';
import { ChatContextProvider } from './context/providers/ChatContextProvider';
import FileModalContainer from './pages/ResultModal/FileModalContainer';
import { FileModalContextProvider } from './context/providers/FileModalContextProvider';
import PromptGuidePopup from './components/PromptGuidePopup';
import Onboarding from './pages/Onboarding';
import PageTemplate from './components/PageTemplate';
import HomePage from './pages/Home';

type Props = {
  deviceContextValue: DeviceContextType;
  isActive: boolean;
  tab: UITabType;
};

class Tab extends PureComponent<Props> {
  render() {
    const { deviceContextValue, isActive, tab } = this.props;
    return (
      <div
        className={`${isActive ? '' : 'hidden'} `}
        data-active={isActive ? 'true' : 'false'}
      >
        <DeviceContextProvider deviceContextValue={deviceContextValue}>
          <UIContextProvider tab={tab}>
            <FileModalContextProvider tab={tab}>
              <AppNavigationProvider tab={tab}>
                <SearchContextProvider tab={tab}>
                  <ChatContextProvider>
                    <Routes>
                      <Route
                        path="*"
                        element={<ContentContainer tab={tab} />}
                      />
                    </Routes>
                    <Settings />
                    <ReportBugModal />
                    <FileModalContainer repoName={tab.repoName} />
                    <PromptGuidePopup />
                    <Onboarding />
                  </ChatContextProvider>
                </SearchContextProvider>
              </AppNavigationProvider>
            </FileModalContextProvider>
          </UIContextProvider>
        </DeviceContextProvider>
      </div>
    );
  }
}

export default Tab;
