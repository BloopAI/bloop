import React from 'react';

const context = React.createContext<{
  setTarget: (v: any) => void;
  target: HTMLDivElement | null;
}>({
  setTarget: (nextValue: any) => {},
  target: null,
});

context.displayName = 'ScrollToBottomInternalContext';

export default context;
