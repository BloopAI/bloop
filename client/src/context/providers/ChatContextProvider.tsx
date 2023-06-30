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

  const contextValue = useMemo(
    () => ({
      conversation,
      setConversation,
      isChatOpen,
      setChatOpen,
      showTooltip,
      setShowTooltip,
      tooltipText,
      setTooltipText,
      submittedQuery,
      setSubmittedQuery,
      selectedLines,
      setSelectedLines,
      threadId,
      setThreadId,
      queryId,
      setQueryId,
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
  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
