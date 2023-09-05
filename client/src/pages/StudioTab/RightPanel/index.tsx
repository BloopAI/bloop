import React, { Dispatch, memo, SetStateAction } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TokensUsageProgress from '../TokensUsageProgress';
import { TOKEN_LIMIT } from '../../../consts/codeStudio';
import Button from '../../../components/Button';
import {
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import { Info, Template } from '../../../icons';
import { CodeStudioMessageType } from '../../../types/api';
import Conversation from './Conversation';

type Props = {
  tokensTotal: number;
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
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
}: Props) => {
  useTranslation();
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-8 h-11.5 border-b border-bg-border bg-bg-sub shadow-low select-none flex-shrink-0">
        <div className="flex items-center gap-1.5 text-label-muted">
          <p className="body-s text-label-title">
            <Trans>Studio conversation</Trans>
          </p>
          <TokensUsageProgress percent={(tokensTotal / TOKEN_LIMIT) * 100} />
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
        <Button
          size="tiny"
          variant="secondary"
          onClick={() =>
            setLeftPanel({
              type: StudioLeftPanelType.TEMPLATES,
              data: null,
            })
          }
        >
          <Template raw sizeClassName="w-3.5 h-3.5" />
          <Trans>My templates</Trans>
        </Button>
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
      />
    </>
  );
};

export default memo(RightPanel);
