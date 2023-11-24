import React, { Dispatch, memo, SetStateAction } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TokensUsageProgress from '../TokensUsageProgress';
import { TOKEN_LIMIT } from '../../../../consts/codeStudio';
import { StudioLeftPanelDataType } from '../../../types/general';
import { CodeStudioMessageType, CodeStudioType } from '../../../../types/api';
import Conversation from './Conversation';

type Props = {
  tokensTotal: number;
  setLeftPanel: Dispatch<SetStateAction<StudioLeftPanelDataType>>;
  setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
  messages: CodeStudioMessageType[];
  studioId: string;
  refetchCodeStudio: (keyToUpdate?: keyof CodeStudioType) => Promise<void>;
  handleRestore: () => void;
  isPreviewing: boolean;
  hasContextError: boolean;
  isActiveTab: boolean;
  isChangeUnsaved: boolean;
};

const RightPanel = ({
  tokensTotal,
  setLeftPanel,
  studioId,
  messages,
  refetchCodeStudio,
  setIsHistoryOpen,
  isPreviewing,
  handleRestore,
  hasContextError,
  isActiveTab,
  isChangeUnsaved,
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
              of # tokens
            </Trans>
          </span>
        </div>
      </div>
      <Conversation
        setLeftPanel={setLeftPanel}
        studioId={studioId}
        messages={messages}
        refetchCodeStudio={refetchCodeStudio}
        isTokenLimitExceeded={tokensTotal > TOKEN_LIMIT}
        hasContextError={hasContextError}
        setIsHistoryOpen={setIsHistoryOpen}
        isPreviewing={isPreviewing}
        handleRestore={handleRestore}
        isActiveTab={isActiveTab}
        isChangeUnsaved={isChangeUnsaved}
      />
    </>
  );
};

export default memo(RightPanel);
