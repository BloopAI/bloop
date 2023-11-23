import React, { memo, PropsWithChildren, useMemo, useState } from 'react';
import { ChatContext } from '../chatContext';
import { ChatMessage, ParsedQueryType } from '../../types/general';

type Props = {
  initialSearchHistory?: string[];
};

export const ChatContextProvider = memo(
  ({ children }: PropsWithChildren<Props>) => {
    const [conversation, setConversation] = useState<ChatMessage[]>([]);
    const [isChatOpen, setChatOpen] = useState(false);
    const [tooltipText, setTooltipText] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState<{
      parsed: ParsedQueryType[];
      plain: string;
    }>({
      parsed: [],
      plain: '',
    });
    const [selectedLines, setSelectedLines] = useState<[number, number] | null>(
      null,
    );
    const [threadId, setThreadId] = useState('');
    const [queryId, setQueryId] = useState('');
    const [isHistoryTab, setIsHistoryTab] = useState(false);

    const valuesContextValue = useMemo(
      () => ({
        conversation,
        isChatOpen,
        tooltipText,
        submittedQuery,
        selectedLines,
        threadId,
        queryId,
        isHistoryTab,
      }),
      [
        conversation,
        isChatOpen,
        tooltipText,
        submittedQuery,
        selectedLines,
        threadId,
        queryId,
        isHistoryTab,
      ],
    );

    const settersContextValue = useMemo(
      () => ({
        setConversation,
        setChatOpen,
        setTooltipText,
        setSubmittedQuery,
        setSelectedLines,
        setThreadId,
        setQueryId,
        setIsHistoryTab,
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
  },
);

ChatContextProvider.displayName = 'ChatContextProvider';
