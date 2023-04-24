import React, { PropsWithChildren, useMemo, useState } from 'react';
import { ChatContext } from '../chatContext';
import { ChatMessage } from '../../types/general';

type Props = {
  initialSearchHistory?: string[];
};

export const ChatContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [isChatOpen, setChatOpen] = useState(false);

  const contextValue = useMemo(
    () => ({
      conversation,
      setConversation,
      isChatOpen,
      setChatOpen,
    }),
    [conversation, isChatOpen],
  );
  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
