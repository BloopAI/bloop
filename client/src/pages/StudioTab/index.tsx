import React, { memo } from 'react';
import { StudioTabType } from '../../types/general';
import Content from './Content';

type Props = {
  isActive: boolean;
  tab: StudioTabType;
};

const StudioTab = ({ isActive, tab }: Props) => {
  return (
    <div
      className={`${isActive ? '' : 'hidden'} `}
      data-active={isActive ? 'true' : 'false'}
    >
      <Content tab={tab} />
    </div>
  );
};

export default memo(StudioTab);
