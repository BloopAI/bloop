import React, { PureComponent } from 'react';
import { HomeTabType } from '../../types/general';
import { TabUiContextProvider } from '../../context/providers/TabUiContextProvider';
import Home from './Content';

type Props = {
  isActive: boolean;
  tab: HomeTabType;
};

class HomeTab extends PureComponent<Props> {
  render() {
    const { isActive, tab } = this.props;
    return (
      <div
        className={`${isActive ? '' : 'hidden'} `}
        data-active={isActive ? 'true' : 'false'}
      >
        <TabUiContextProvider tab={tab}>
          <Home />
        </TabUiContextProvider>
      </div>
    );
  }
}

export default HomeTab;
