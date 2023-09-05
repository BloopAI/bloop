import React, { memo, useContext } from 'react';
import { format } from 'date-fns';
import { HistoryConversationTurn } from '../../../types/api';
import { getDateFnsLocale } from '../../../utils';
import { LocaleContext } from '../../../context/localeContext';
import { Calendar } from '../../../icons';
import ConversationTurn from './ConversationTurn';

type Props = {
  date: string;
  studioId: string;
  refetchCodeStudio: () => void;
  refetchHistory: () => void;
  turns: HistoryConversationTurn[];
  isFirst: boolean;
};

const ConversationDay = ({
  turns,
  date,
  studioId,
  refetchCodeStudio,
  refetchHistory,
  isFirst,
}: Props) => {
  const { locale } = useContext(LocaleContext);
  return (
    <div className="flex flex-col gap-3 relative">
      <div className="flex items-center gap-2 body-s-strong text-label-title mb-1 select-none">
        <Calendar className="text-label-base" />
        {!date
          ? format(new Date(), 'EEEE, d MMM yyyy', getDateFnsLocale(locale))
          : format(
              new Date(date + 'T00:00:00.000Z'),
              'EEEE, d MMM yyyy',
              getDateFnsLocale(locale),
            )}
      </div>
      <div className="absolute top-7 left-2.5 bottom-1 w-px bg-bg-border" />
      {turns.map((turn, i) => (
        <ConversationTurn
          key={turn.id}
          {...turn}
          refetchCodeStudio={refetchCodeStudio}
          studioId={studioId}
          refetchHistory={refetchHistory}
          isCurrent={isFirst && i === 0}
        />
      ))}
    </div>
  );
};

export default memo(ConversationDay);
