import { useCallback, useRef, useState } from 'react';

export default function useStateRef(initialState: any) {
  const [state, setState] = useState(initialState);
  const ref = useRef();
  const setValue = useCallback(
    (nextValue: any) => {
      if (typeof nextValue === 'function') {
        setValue((state: any) => {
          nextValue = nextValue(state);

          ref.current = nextValue;

          return nextValue;
        });
      } else {
        ref.current = nextValue;

        setValue(nextValue);
      }
    },
    [ref],
  );

  ref.current = state;

  return [state, setState, ref];
}
