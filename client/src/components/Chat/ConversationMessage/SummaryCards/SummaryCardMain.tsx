import React, { PropsWithChildren } from 'react';
import { Paper } from '../../../../icons';

type Props = {
  onClick: () => void;
  isArticle: boolean;
};

const SummaryCardMain = ({
  onClick,
  children,
  isArticle,
}: PropsWithChildren<Props>) => {
  return (
    <div
      className={`flex items-start gap-3 rounded-md border border-chat-bg-border bg-chat-bg-base ${
        isArticle ? 'p-4' : ''
      } shadow-low h-30 overflow-scroll relative z-30`}
    >
      {isArticle && (
        <div className="py-1.5 px-2 rounded bg-chat-bg-border overflow-hidden select-none flex-shrink-0">
          <div className="w-3 h-4">
            <Paper raw />
          </div>
        </div>
      )}
      <div className="body-s text-label-title overflow-hidden max-h-full pointer-events-none summary-card w-full">
        {children}
      </div>
      <button
        className="absolute top-0 bottom-0 left-0 right-0 opacity-0 bg-chat-bg-base/75 hover:opacity-100 hover:backdrop-blur-sm z-10"
        onClick={onClick}
      >
        <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 body-s-strong text-label-link">
          Open results
        </span>
      </button>
    </div>
  );
};

export default SummaryCardMain;
