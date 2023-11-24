import React from 'react';

const context = React.createContext({
  scrollToBottom: (b: { behavior?: 'smooth' | 'auto' }) => {},
});

context.displayName = 'ScrollToBottomFunctionContext';

export default context;
