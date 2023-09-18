import React, { memo, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateFnsLocale } from '../../../utils';
import { HistoryConversationTurn } from '../../../types/api';
import { LocaleContext } from '../../../context/localeContext';

type Props = HistoryConversationTurn & {
  handlePreview: () => void;
  isCurrent: boolean;
  isPreviewed: boolean;
};

const ConversationTurn = ({
  modified_at,
  messages,
  isCurrent,
  handlePreview,
  isPreviewed,
}: Props) => {
  useTranslation();
  const { locale } = useContext(LocaleContext);

  const lastMessage = useMemo(() => {
    return messages[messages.length - 1];
  }, []);

  const text = useMemo(() => {
    return lastMessage
      ? 'User' in lastMessage
        ? lastMessage.User
        : lastMessage.Assistant
      : '';
  }, [lastMessage]);

  return (
    <button
      className={`flex overflow-hidden flex-col items-start gap-3 p-3 pl-7 rounded-md border text-left ${
        isPreviewed
          ? 'border-bg-border bg-bg-base'
          : 'border-transparent hover:border-bg-border hover:bg-bg-base'
      } cursor-pointer group relative`}
      onClick={handlePreview}
    >
      <div
        className={`absolute top-5 left-1.5 transform translate-x-px w-1.5 h-1.5 rounded-full ${
          !isCurrent ? 'bg-bg-border-hover' : 'bg-bg-main'
        }`}
      />
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
      <div
        className={`body-s ${
          isPreviewed ? 'text-label-title' : 'text-label-base'
        } overflow-hidden w-full`}
      >
        <p>{text.length > 55 ? text.slice(0, 52) + '...' : text}</p>
      </div>
    </button>
  );
};

export default memo(ConversationTurn);
