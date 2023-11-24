import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import debounceFn from './debounce';

type Props = {
  debounce: number;
  name: string;
  onEvent: (p: { timeStampLow: number }) => void;
  target: HTMLElement;
};

const EventSpy = ({ debounce = 200, name, onEvent, target }: Props) => {
  // We need to save the "onEvent" to ref.
  // This is because "onEvent" may change from time to time, but debounce may still fire to the older callback.
  const onEventRef = useRef<(p: { timeStampLow: number }) => void>();

  onEventRef.current = onEvent;

  const debouncer = useMemo(
    () =>
      debounceFn((event: any) => {
        const { current } = onEventRef;

        current && current(event);
      }, debounce),
    [debounce, onEventRef],
  );

  const handleEvent = useCallback(
    (event: any) => {
      event.timeStampLow = Date.now();

      debouncer(event);
    },
    [debouncer],
  );

  useLayoutEffect(() => {
    target.addEventListener(name, handleEvent, { passive: true });
    handleEvent({ target, type: name });

    return () => target.removeEventListener(name, handleEvent);
  }, [name, handleEvent, target]);

  return null;
};

export default EventSpy;
