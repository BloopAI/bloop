import React, { Dispatch, memo, SetStateAction } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TokensUsageProgress from '../TokensUsageProgress';
import { TOKEN_LIMIT } from '../../../consts/codeStudio';
import { StudioPanelDataType } from '../../../types/general';
import { Info } from '../../../icons';
import { CodeStudioMessageType } from '../../../types/api';
import Conversation from './Conversation';

type Props = {
  tokensTotal: number;
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
  messages: CodeStudioMessageType[];
  studioId: string;
  refetchCodeStudio: () => Promise<void>;
};

const RightPanel = ({
  tokensTotal,
  setLeftPanel,
  studioId,
  messages,
  refetchCodeStudio,
  setIsHistoryOpen,
}: Props) => {
  useTranslation();
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-8 h-11.5 border-b border-bg-border bg-bg-sub shadow-low select-none flex-shrink-0">
        <div className="flex items-center gap-1.5 text-label-muted">
          <p className="body-s text-label-title">
            <Trans>Studio conversation</Trans>
          </p>
          <TokensUsageProgress
            percent={!tokensTotal ? 0 : (tokensTotal / TOKEN_LIMIT) * 100}
          />
          <span className="caption text-label-base">
            <Trans values={{ count: tokensTotal, total: TOKEN_LIMIT }}>
              <span
                className={tokensTotal > TOKEN_LIMIT ? 'text-bg-danger' : ''}
              >
                #
              </span>{' '}
              of #
            </Trans>
          </span>
        </div>
      </div>
      {tokensTotal > TOKEN_LIMIT && (
        <div className="flex items-center gap-2 px-8 py-2 bg-bg-danger/12 select-none">
          <Info raw sizeClassName="w-4.5 h-4.5" className="text-bg-danger" />
          <p className="text-bg-danger caption">
            <Trans>
              Conversation tokens exceeded. Reduce the number of messages to
              generate!
            </Trans>
          </p>
        </div>
      )}
      <Conversation
        setLeftPanel={setLeftPanel}
        studioId={studioId}
        messages={messages}
        refetchCodeStudio={refetchCodeStudio}
        isTokenLimitExceeded={tokensTotal > TOKEN_LIMIT}
        setIsHistoryOpen={setIsHistoryOpen}
      />
    </>
  );
};

export default memo(RightPanel);
