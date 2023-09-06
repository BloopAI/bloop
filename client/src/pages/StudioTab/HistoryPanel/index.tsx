import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import { CloseSign } from '../../../icons';
import { HistoryConversationTurn } from '../../../types/api';
import { getCodeStudioHistory } from '../../../services/api';
import ConversationTurn from './ConversationDay';

type Props = {
  setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
  studioId: string;
  refetchCodeStudio: () => void;
  handlePreview: (
    turn?: HistoryConversationTurn,
    closeHistory?: boolean,
  ) => void;
};

const HistoryPanel = ({
  setIsHistoryOpen,
  studioId,
  refetchCodeStudio,
  handlePreview,
}: Props) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<
    Record<string, HistoryConversationTurn[]>
  >({});

  const refetchHistory = useCallback(() => {
    getCodeStudioHistory(studioId).then((resp) => {
      const historyMapped: Record<string, HistoryConversationTurn[]> = {};
      resp.forEach((t) => {
        const date = t.modified_at.slice(0, 10);
        historyMapped[date] = [...(historyMapped[date] || []), t];
      });
      setHistory(historyMapped);
    });
  }, [studioId]);

  useEffect(() => {
    refetchHistory();
  }, [studioId]);

  return (
    <div className="flex flex-col w-52 flex-shrink-0 border-r border-bg-border overflow-auto">
      <div className="flex gap-1 px-8 justify-between items-center border-b flex-shrink-0 border-bg-border bg-bg-shade shadow-low h-11.5">
        <div className="flex items-center gap-3">
          <p className="body-s text-label-title">
            <Trans>History</Trans>
          </p>
        </div>
        <Button
          size="small"
          variant="tertiary"
          onlyIcon
          title={t('Close')}
          onClick={() => setIsHistoryOpen(false)}
        >
          <CloseSign />
        </Button>
      </div>
      <div className="flex flex-col gap-4 py-8 px-4 overflow-auto">
        {Object.keys(history).map((date, i) => (
          <ConversationTurn
            key={date}
            date={date}
            studioId={studioId}
            refetchCodeStudio={refetchCodeStudio}
            refetchHistory={refetchHistory}
            turns={history[date]}
            isFirst={i === 0}
            handlePreview={handlePreview}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(HistoryPanel);
