import { Dispatch, memo, SetStateAction, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import Button from '../../../components/Button';
import { ArrowLeft } from '../../../icons';
import { HistoryConversationTurn } from '../../../types/api';
import ConversationTurn from './ConversationTurn';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
};

const HistoryPanel = ({ setLeftPanel }: Props) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<HistoryConversationTurn[]>([]);

  useEffect(() => {
    Promise.resolve([
      {
        messages: [
          {
            User: 'Hey',
            timestamp: '2023-08-21T13:00:00Z',
          },
          {
            Assistant: 'Hello',
            timestamp: '2023-08-21T13:01:00Z',
          },
        ],
      },
      {
        messages: [
          {
            User: 'Hey',
            timestamp: '2023-08-20T12:00:00Z',
          },
          {
            Assistant: 'Hello',
            timestamp: '2023-08-20T12:03:00Z',
          },
          {
            User: 'Tell me a joke',
            timestamp: '2023-08-20T13:04:00Z',
          },
          {
            Assistant: `Sure, here's one for you:

Why don't scientists trust atoms?

Because they make up everything!`,
            timestamp: '2023-08-20T13:05:00Z',
          },
        ],
      },
    ] as HistoryConversationTurn[]).then(setHistory);
  }, []);

  return (
    <div className="flex flex-col w-full">
      <div className="flex gap-1 px-8 justify-between items-center border-b border-bg-border bg-bg-shade shadow-low h-11.5">
        <div className="flex items-center gap-3">
          <Button
            size="small"
            variant="tertiary"
            onlyIcon
            title={t('Back')}
            onClick={() => setLeftPanel({ type: StudioLeftPanelType.CONTEXT })}
          >
            <ArrowLeft />
          </Button>
          <p className="body-s text-label-title">
            <Trans>History</Trans>
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-8">
        {history.map((turn, i) => (
          <ConversationTurn key={i} messages={turn.messages} />
        ))}
      </div>
    </div>
  );
};

export default memo(HistoryPanel);
