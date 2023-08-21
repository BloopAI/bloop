import React, { PureComponent } from 'react';
import Settings from '../../components/Settings';
import { RepoTabType } from '../../types/general';
import '../../index.css';
import ReportBugModal from '../../components/ReportBugModal';
import { UIContextProvider } from '../../context/providers/UiContextProvider';
import { AppNavigationProvider } from '../../context/providers/AppNavigationProvider';
import { SearchContextProvider } from '../../context/providers/SearchContextProvider';
import { ChatContextProvider } from '../../context/providers/ChatContextProvider';
import { FileModalContextProvider } from '../../context/providers/FileModalContextProvider';
import PromptGuidePopup from '../../components/PromptGuidePopup';
import Onboarding from '../Onboarding';
import { FileHighlightsContextProvider } from '../../context/providers/FileHighlightsContextProvider';
import FileModalContainer from './ResultModal/FileModalContainer';
import ContentContainer from './Content';

type Props = {
  isActive: boolean;
  tab: RepoTabType;
};

class RepoTab extends PureComponent<Props> {
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

export default RepoTab;
