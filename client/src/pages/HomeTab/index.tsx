import React, { PureComponent } from 'react';
import Settings from '../../components/Settings';
import { HomeTabType } from '../../types/general';
import '../../index.css';
import ReportBugModal from '../../components/ReportBugModal';
import { UIContextProvider } from '../../context/providers/UiContextProvider';
import Onboarding from '../Onboarding';
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
        <UIContextProvider tab={tab}>
          <Home />
          <Settings />
          <ReportBugModal />
          <Onboarding />
        </UIContextProvider>
      </div>
    );
  }
}

export default HomeTab;
