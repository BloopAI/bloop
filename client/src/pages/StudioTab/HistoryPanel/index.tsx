import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import Button from '../../../components/Button';
import { ArrowLeft } from '../../../icons';
import { CodeStudioType, HistoryConversationTurn } from '../../../types/api';
import { getCodeStudioHistory } from '../../../services/api';
import ConversationTurn from './ConversationDay';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  studioId: string;
  refetchCodeStudio: () => void;
};

const HistoryPanel = ({ setLeftPanel, studioId, refetchCodeStudio }: Props) => {
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
    <div className="flex flex-col w-full overflow-auto">
      <div className="flex gap-1 px-8 justify-between items-center border-b flex-shrink-0 border-bg-border bg-bg-shade shadow-low h-11.5">
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
      <div className="flex flex-col gap-4 p-8 overflow-auto">
        {Object.keys(history).map((date, i) => (
          <ConversationTurn
            key={date}
            date={date}
            studioId={studioId}
            refetchCodeStudio={refetchCodeStudio}
            refetchHistory={refetchHistory}
            turns={history[date]}
            isFirst={i === 0}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(HistoryPanel);
