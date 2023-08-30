import React, { PureComponent } from 'react';
import { RepoTabType } from '../../types/general';
import { TabUiContextProvider } from '../../context/providers/TabUiContextProvider';
import { AppNavigationProvider } from '../../context/providers/AppNavigationProvider';
import { SearchContextProvider } from '../../context/providers/SearchContextProvider';
import { ChatContextProvider } from '../../context/providers/ChatContextProvider';
import { FileModalContextProvider } from '../../context/providers/FileModalContextProvider';
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
        <TabUiContextProvider tab={tab}>
          <FileModalContextProvider tab={tab}>
            <AppNavigationProvider tab={tab}>
              <SearchContextProvider tab={tab}>
                <ChatContextProvider>
                  <FileHighlightsContextProvider>
                    <ContentContainer tab={tab} />
                    <FileModalContainer repoName={tab.repoName} />
                  </FileHighlightsContextProvider>
                </ChatContextProvider>
              </SearchContextProvider>
            </AppNavigationProvider>
          </FileModalContextProvider>
        </TabUiContextProvider>
      </div>
    );
  }
}

export default RepoTab;
