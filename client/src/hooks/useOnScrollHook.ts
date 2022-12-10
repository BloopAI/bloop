import React from 'react';

export function useOnScrollHook(handler: (e: Event) => void) {
  React.useEffect(() => {
    const listener = (event: Event) => {
      handler(event);
    };
    document.addEventListener('scroll', listener, true);
    return () => {
      document.removeEventListener('scroll', listener);
    };
  }, [handler]);
}
