import React, { PropsWithChildren, useMemo, useState } from 'react';
import { ChatContext } from '../chatContext';
import { ChatMessage } from '../../types/general';

type Props = {
  initialSearchHistory?: string[];
};

export const ChatContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [isChatOpen, setChatOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipText, setTooltipText] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedLines, setSelectedLines] = useState<[number, number] | null>(
    null,
  );
  const [threadId, setThreadId] = useState('');
  const [queryId, setQueryId] = useState('');

  const valuesContextValue = useMemo(
    () => ({
      conversation,
      isChatOpen,
      showTooltip,
      tooltipText,
      submittedQuery,
      selectedLines,
      threadId,
      queryId,
    }),
    [
      conversation,
      isChatOpen,
      showTooltip,
      tooltipText,
      submittedQuery,
      selectedLines,
      threadId,
      queryId,
    ],
  );

  const settersContextValue = useMemo(
    () => ({
      setConversation,
      setChatOpen,
      setShowTooltip,
      setTooltipText,
      setSubmittedQuery,
      setSelectedLines,
      setThreadId,
      setQueryId,
    }),
    [],
  );

  return (
    <ChatContext.Setters.Provider value={settersContextValue}>
      <ChatContext.Values.Provider value={valuesContextValue}>
        {children}
      </ChatContext.Values.Provider>
    </ChatContext.Setters.Provider>
  );
};
