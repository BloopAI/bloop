import { Dispatch, memo, SetStateAction, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  StudioConversationMessageAuthor,
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import Button from '../../../components/Button';
import { ArrowLeft } from '../../../icons';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
};

const HistoryPanel = ({ setLeftPanel }: Props) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    Promise.resolve([
      {
        messages: [
          { author: StudioConversationMessageAuthor.USER, message: 'Hey' },
          {
            author: StudioConversationMessageAuthor.ASSISTANT,
            message: 'Hello',
          },
        ],
        timestamp: '2023-08-21T13:00:00Z',
        id: '1',
      },
      {
        messages: [
          { author: StudioConversationMessageAuthor.USER, message: 'Hey' },
          {
            author: StudioConversationMessageAuthor.ASSISTANT,
            message: 'Hello',
          },
          {
            author: StudioConversationMessageAuthor.USER,
            message: 'Tell me a joke',
          },
          {
            author: StudioConversationMessageAuthor.ASSISTANT,
            message: `Sure, here's one for you:

Why don't scientists trust atoms?

Because they make up everything!`,
          },
        ],
        timestamp: '2023-08-20T13:00:00Z',
        id: '2',
      },
    ]).then(setHistory);
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
      <div className="flex flex-col gap-4 p-8"></div>
    </div>
  );
};

export default memo(HistoryPanel);
