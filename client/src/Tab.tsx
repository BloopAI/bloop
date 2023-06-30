import { PureComponent } from 'react';
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
        <BrowserRouter>
          <DeviceContextProvider deviceContextValue={deviceContextValue}>
            <UIContextProvider tab={tab}>
              <FileModalContextProvider>
                <AppNavigationProvider>
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
                    </ChatContextProvider>
                  </SearchContextProvider>
                </AppNavigationProvider>
              </FileModalContextProvider>
            </UIContextProvider>
          </DeviceContextProvider>
        </BrowserRouter>
      </div>
    );
  }
}

export default Tab;
