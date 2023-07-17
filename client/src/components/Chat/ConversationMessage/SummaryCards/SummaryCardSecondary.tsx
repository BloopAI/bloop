import React, { PropsWithChildren } from 'react';

type Props = {
  isMiddle: boolean;
  isArticle: boolean;
};

const SummaryCardSecondary = ({
  children,
  isMiddle,
  isArticle,
}: PropsWithChildren<Props>) => {
  return (
    <div
      className={`${
        isArticle ? 'px-2 py-1.5' : ''
      } rounded-md border pointer-events-none border-chat-bg-border 
        bg-chat-bg-base h-30 overflow-scroll caption relative ${
          isMiddle
            ? 'z-0 mx-6 -mb-28 group-summary-hover:-mb-[6.5rem]'
            : 'z-10 mx-3 -mb-28 group-summary-hover:-mb-24'
        } transition-all duration-200 summary-card`}
    >
      {children}
    </div>
  );
};

export default SummaryCardSecondary;
