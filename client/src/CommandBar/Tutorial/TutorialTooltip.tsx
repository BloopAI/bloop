import React, { memo, PropsWithChildren, useEffect, useState } from 'react';
import Tippy from '@tippyjs/react/headless';

type Props = {
  content: React.ReactElement;
  wrapperClassName?: string;
};

const TutorialTooltip = ({
  children,
  content,
  wrapperClassName,
}: PropsWithChildren<Props>) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 150);
  }, []);

  return (
    <Tippy
      animation={false}
      visible={isVisible}
      placement="left"
      render={() => content}
      interactive
    >
      <div className={wrapperClassName || 'flex flex-col w-full'}>
        {children}
      </div>
    </Tippy>
  );
};

export default memo(TutorialTooltip);
