import { memo, useContext } from 'react';
import { format } from 'date-fns';
import { Trans, useTranslation } from 'react-i18next';
import { CodeStudioMessageType } from '../../../types/api';
import { getDateFnsLocale } from '../../../utils';
import { LocaleContext } from '../../../context/localeContext';
import { Calendar } from '../../../icons';
import Button from '../../../components/Button';

type Props = {
  messages: (CodeStudioMessageType & { timestamp: string })[];
};

const ConversationTurn = ({ messages }: Props) => {
  const { t } = useTranslation();
  const { locale } = useContext(LocaleContext);
  return (
    <div className="flex flex-col gap-3 relative">
      <div className="flex items-center gap-2 body-s-strong text-label-title mb-1">
        <Calendar className="text-label-base" />
        {format(
          new Date(messages[0].timestamp),
          'EEEE, d MMM yyyy',
          getDateFnsLocale(locale),
        )}
      </div>
      <div className="absolute top-7 left-2.5 bottom-1 w-px bg-bg-border" />
      {messages.map((m, i) => (
        <div
          key={i}
          className="flex flex-col items-start gap-3 p-3 pl-7 rounded-md border border-transparent hover:border-bg-border hover:bg-bg-base group relative"
        >
          <div className="absolute top-5 left-1.5 transform translate-x-px w-1.5 h-1.5 rounded-full bg-bg-border-hover" />
          <Button
            size="tiny"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
          >
            <Trans>Restore</Trans>
          </Button>
          <div className="h-5 flex items-center px-1 rounded-sm bg-label-title/15 caption text-label-title">
            {format(new Date(m.timestamp), 'hh:mm a', getDateFnsLocale(locale))}
          </div>
          <p className="body-m text-label-title">
            {'User' in m ? m.User : m.Assistant}
          </p>
        </div>
      ))}
    </div>
  );
};

export default memo(ConversationTurn);
