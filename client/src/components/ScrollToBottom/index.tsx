import React, { memo, MutableRefObject, PropsWithChildren } from 'react';
import Composer from './Composer';
import Panel from './Panel';

type CoreProps = {
  className: string;
  wrapperRef?: MutableRefObject<HTMLDivElement | null>;
};

const BasicScrollToBottomCore = ({
  children,
  className,
  wrapperRef,
}: PropsWithChildren<CoreProps>) => {
  return (
    <div className={`relative ${className}`}>
      <Panel ref={wrapperRef}>{children}</Panel>
    </div>
  );
};

type Props = {
  className: string;
  wrapperRef?: MutableRefObject<HTMLDivElement | null>;
};

const BasicScrollToBottom = ({
  children,
  className,
  wrapperRef,
}: PropsWithChildren<Props>) => (
  <Composer>
    <BasicScrollToBottomCore className={className} wrapperRef={wrapperRef}>
      {children}
    </BasicScrollToBottomCore>
  </Composer>
);

export default memo(BasicScrollToBottom);
