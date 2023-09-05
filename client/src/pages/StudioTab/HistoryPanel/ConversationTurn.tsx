import React, { memo, useCallback, useContext, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import Button from '../../../components/Button';
import { getDateFnsLocale } from '../../../utils';
import MarkdownWithCode from '../../../components/MarkdownWithCode';
import { HistoryConversationTurn } from '../../../types/api';
import { patchCodeStudio } from '../../../services/api';
import { LocaleContext } from '../../../context/localeContext';

type Props = HistoryConversationTurn & {
  studioId: string;
  refetchCodeStudio: () => void;
  refetchHistory: () => void;
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
}: Props) => {
  useTranslation();
  const { locale } = useContext(LocaleContext);

  const handleRestore = useCallback(() => {
    patchCodeStudio(studioId, { context, messages }).then(() => {
      refetchCodeStudio();
      refetchHistory();
    });
  }, [studioId, refetchCodeStudio, context, messages, refetchHistory]);

  const lastMessage = useMemo(() => {
    return messages[messages.length - 1];
  }, []);

  return (
    <div className="flex overflow-hidden flex-col items-start gap-3 p-3 pl-7 rounded-md border border-transparent hover:border-bg-border hover:bg-bg-base group relative">
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
      <div className="code-studio-md body-s  text-label-title overflow-hidden w-full">
        <MarkdownWithCode
          markdown={
            'User' in lastMessage ? lastMessage.User : lastMessage.Assistant
          }
          isCodeStudio
        />
      </div>
    </div>
  );
};

export default memo(ConversationTurn);
