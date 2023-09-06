import React, { memo, useCallback, useContext, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateFnsLocale } from '../../../utils';
import { HistoryConversationTurn } from '../../../types/api';
import { patchCodeStudio } from '../../../services/api';
import { LocaleContext } from '../../../context/localeContext';
import Button from '../../../components/Button';

type Props = HistoryConversationTurn & {
  studioId: string;
  refetchCodeStudio: () => void;
  refetchHistory: () => void;
  handlePreview: (e: any, closeHistory?: boolean) => void;
  isCurrent: boolean;
};

const ConversationTurn = ({
  modified_at,
  messages,
  context,
  refetchHistory,
  refetchCodeStudio,
  studioId,
  isCurrent,
  handlePreview,
}: Props) => {
  useTranslation();
  const { locale } = useContext(LocaleContext);

  const handleRestore = useCallback(() => {
    patchCodeStudio(studioId, { context, messages }).then(() => {
      refetchCodeStudio();
      refetchHistory();
      handlePreview(null, true);
    });
  }, [studioId, refetchCodeStudio, context, messages, refetchHistory]);

  const lastMessage = useMemo(() => {
    return messages[messages.length - 1];
  }, []);

  return (
    <button
      className="flex overflow-hidden flex-col items-start gap-3 p-3 pl-7 rounded-md border text-left border-transparent hover:border-bg-border hover:bg-bg-base cursor-pointer group relative"
      onClick={handlePreview}
    >
      <div
        className={`absolute top-5 left-1.5 transform translate-x-px w-1.5 h-1.5 rounded-full ${
          modified_at ? 'bg-bg-border-hover' : 'bg-bg-main'
        }`}
      />
      {!isCurrent && (
        <Button
          size="tiny"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
          onClick={handleRestore}
        >
          <Trans>Restore</Trans>
        </Button>
      )}
      <div
        className={`h-5 flex items-center px-1 rounded-sm ${
          !isCurrent
            ? 'bg-label-title/15 text-label-title'
            : 'bg-bg-main/15 text-bg-main'
        } caption select-none`}
      >
        {isCurrent
          ? 'Current session'
          : format(
              new Date(modified_at + '.000Z'),
              'hh:mm a',
              getDateFnsLocale(locale),
            )}
      </div>
      <div className="body-s text-label-title overflow-hidden w-full">
        <p>
          {('User' in lastMessage ? lastMessage.User : lastMessage.Assistant)
            .split(' ')
            .slice(0, 3)
            .join(' ')}
        </p>
      </div>
    </button>
  );
};

export default memo(ConversationTurn);
