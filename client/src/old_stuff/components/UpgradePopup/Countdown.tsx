import { memo, useContext, useEffect, useState } from 'react';
import { intervalToDuration } from 'date-fns';
import { PersonalQuotaContext } from '../../../context/personalQuotaContext';

type Props = {};

const Countdown = ({}: Props) => {
  const { resetAt } = useContext(PersonalQuotaContext.Values);
  const [timer, setTimer] = useState(
    intervalToDuration({
      end: new Date(resetAt),
      start: new Date(),
    }),
  );

  useEffect(() => {
    const intervalId = setInterval(
      () =>
        setTimer(
          intervalToDuration({
            end: new Date(resetAt),
            start: new Date(),
          }),
        ),
      1000,
    );
    return () => {
      clearInterval(intervalId);
    };
  }, [resetAt]);
  return (
    <span className="w-24 inline-block text-left">
      {timer.days !== undefined
        ? (timer.days * 24 + timer.hours!).toString().padStart(2, '0')
        : '-'}
      :{timer.minutes?.toString().padStart(2, '0') || '-'}:
      {timer.seconds?.toString().padStart(2, '0') || '-'}
    </span>
  );
};

export default memo(Countdown);
