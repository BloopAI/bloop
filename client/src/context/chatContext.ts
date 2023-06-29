import { createContext, Dispatch, SetStateAction } from 'react';
import { ChatMessage } from '../types/general';

type ContextType = {
  conversation: ChatMessage[];
  setConversation: Dispatch<SetStateAction<ChatMessage[]>>;
  isChatOpen: boolean;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  showTooltip: boolean;
  setShowTooltip: Dispatch<SetStateAction<boolean>>;
  tooltipText: string;
  setTooltipText: Dispatch<SetStateAction<string>>;
  threadId: string;
  setThreadId: Dispatch<SetStateAction<string>>;
  queryId: string;
  setQueryId: Dispatch<SetStateAction<string>>;
  submittedQuery: string;
  setSubmittedQuery: Dispatch<SetStateAction<string>>;
  selectedLines: [number, number] | null;
  setSelectedLines: Dispatch<SetStateAction<[number, number] | null>>;
};

export const ChatContext = createContext<ContextType>({
  conversation: [],
  setConversation: () => {},
  isChatOpen: false,
  setChatOpen: () => {},
  showTooltip: false,
  setShowTooltip: () => {},
  tooltipText: '',
  setTooltipText: () => {},
  submittedQuery: '',
  setSubmittedQuery: () => {},
  threadId: '',
  setThreadId: () => {},
  queryId: '',
  setQueryId: () => {},
  selectedLines: null,
  setSelectedLines: () => {},
});
