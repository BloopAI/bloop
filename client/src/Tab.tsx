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

type Props = {
  deviceContextValue: DeviceContextType;
  isActive: boolean;
  tab: UITabType;
};

function Tab({ deviceContextValue, isActive, tab }: Props) {
  return (
    <div className={`${isActive ? '' : 'hidden'} `}>
      <BrowserRouter>
        <DeviceContextProvider deviceContextValue={deviceContextValue}>
          <UIContextProvider tab={tab}>
            <AppNavigationProvider>
              <SearchContextProvider tab={tab}>
                <ChatContextProvider>
                  <Routes>
                    <Route path="*" element={<ContentContainer tab={tab} />} />
                  </Routes>
                  <Settings />
                  <ReportBugModal />
                </ChatContextProvider>
              </SearchContextProvider>
            </AppNavigationProvider>
          </UIContextProvider>
        </DeviceContextProvider>
      </BrowserRouter>
    </div>
  );
}

export default Tab;
