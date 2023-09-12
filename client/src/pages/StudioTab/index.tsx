import React, { memo } from 'react';
import { StudioTabType } from '../../types/general';
import { StudioContextProvider } from '../../context/providers/StudioContextProvider';
import Content from './Content';

type Props = {
  isActive: boolean;
  isTransitioning: boolean;
  tab: StudioTabType;
};

const StudioTab = ({ isActive, tab, isTransitioning }: Props) => {
  return (
    <div
      className={`${isActive ? '' : 'hidden'} ${
        isTransitioning ? 'opacity-70' : 'opacity-100'
      }`}
      data-active={isActive ? 'true' : 'false'}
    >
      <StudioContextProvider>
        <Content tab={tab} isActive={isActive} />
      </StudioContextProvider>
    </div>
  );
};

export default memo(StudioTab);
