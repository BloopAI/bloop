import React, { PureComponent } from 'react';
import Settings from '../../components/Settings';
import { UITabType } from '../../types/general';
import '../../index.css';
import ReportBugModal from '../../components/ReportBugModal';

type Props = {
  isActive: boolean;
  tab: UITabType;
};

class StudioTab extends PureComponent<Props> {
  render() {
    const { isActive, tab } = this.props;
    return (
      <div
        className={`${isActive ? '' : 'hidden'} `}
        data-active={isActive ? 'true' : 'false'}
      >
        <Settings />
        <ReportBugModal />
      </div>
    );
  }
}

export default StudioTab;
