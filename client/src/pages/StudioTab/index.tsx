import React, { PureComponent } from 'react';
import Settings from '../../components/Settings';
import { StudioTabType, UITabType } from '../../types/general';
import '../../index.css';
import ReportBugModal from '../../components/ReportBugModal';
import Content from './Content';

type Props = {
  isActive: boolean;
  tab: StudioTabType;
};

class StudioTab extends PureComponent<Props> {
  render() {
    const { isActive, tab } = this.props;
    return (
      <div
        className={`${isActive ? '' : 'hidden'} `}
        data-active={isActive ? 'true' : 'false'}
      >
        <Content tab={tab} />
        <Settings />
        <ReportBugModal />
      </div>
    );
  }
}

export default StudioTab;
