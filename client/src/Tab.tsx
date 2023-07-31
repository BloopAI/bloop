import React, { PureComponent } from 'react';
import Settings from './components/Settings';
import { UITabType } from './types/general';
import './index.css';
import ReportBugModal from './components/ReportBugModal';
import { UIContextProvider } from './context/providers/UiContextProvider';
import { AppNavigationProvider } from './context/providers/AppNavigationProvider';
import ContentContainer from './pages';
import { SearchContextProvider } from './context/providers/SearchContextProvider';
import { ChatContextProvider } from './context/providers/ChatContextProvider';
import FileModalContainer from './pages/ResultModal/FileModalContainer';
import { FileModalContextProvider } from './context/providers/FileModalContextProvider';
import PromptGuidePopup from './components/PromptGuidePopup';
import Onboarding from './pages/Onboarding';
import { FileHighlightsContextProvider } from './context/providers/FileHighlightsContextProvider';

type Props = {
  isActive: boolean;
  tab: UITabType;
};

class Tab extends PureComponent<Props> {
  render() {
    const { isActive, tab } = this.props;
    return (
      <div
        className={`${isActive ? '' : 'hidden'} `}
        data-active={isActive ? 'true' : 'false'}
      >
        <UIContextProvider tab={tab}>
          <FileModalContextProvider tab={tab}>
            <AppNavigationProvider tab={tab}>
              <SearchContextProvider tab={tab}>
                <ChatContextProvider>
                  <FileHighlightsContextProvider>
                    <ContentContainer tab={tab} />
                    <Settings />
                    <ReportBugModal />
                    <FileModalContainer repoName={tab.repoName} />
                    <PromptGuidePopup />
                    <Onboarding />
                  </FileHighlightsContextProvider>
                </ChatContextProvider>
              </SearchContextProvider>
            </AppNavigationProvider>
          </FileModalContextProvider>
        </UIContextProvider>
      </div>
    );
  }
}

export default Tab;
