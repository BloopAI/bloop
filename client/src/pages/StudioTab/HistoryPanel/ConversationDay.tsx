import React, { memo, useContext } from 'react';
import { format } from 'date-fns';
import { HistoryConversationTurn } from '../../../types/api';
import { getDateFnsLocale } from '../../../utils';
import { LocaleContext } from '../../../context/localeContext';
import { Calendar } from '../../../icons';
import ConversationTurn from './ConversationTurn';

type Props = {
  date: string;
  turns: HistoryConversationTurn[];
  isFirst: boolean;
  handlePreview: (turn?: HistoryConversationTurn, i?: number) => void;
  currentlyPreviewingIndex: number;
};

const ConversationDay = ({
  turns,
  date,
  isFirst,
  handlePreview,
  currentlyPreviewingIndex,
}: Props) => {
  const { locale } = useContext(LocaleContext);
  return (
    <div className="flex flex-col gap-3 relative">
      <div className="flex items-center gap-2 body-s-strong text-label-title mb-1 select-none">
        <Calendar className="text-label-base" />
        {!date
          ? format(new Date(), 'EE, d MMM yyyy', getDateFnsLocale(locale))
          : format(
              new Date(date + 'T00:00:00.000Z'),
              'EE, d MMM yyyy',
              getDateFnsLocale(locale),
            )}
      </div>
      <div className="absolute top-7 left-2.5 bottom-1 w-px bg-bg-border" />
      {turns.map((turn, i) => (
        <ConversationTurn
          key={turn.id}
          {...turn}
          isCurrent={isFirst && i === 0}
          handlePreview={() =>
            handlePreview(isFirst && i === 0 ? undefined : turn, i)
          }
          isPreviewed={currentlyPreviewingIndex === i}
        />
      ))}
    </div>
  );
};

export default memo(ConversationDay);
