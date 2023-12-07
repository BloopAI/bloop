import { createContext, Dispatch, SetStateAction } from 'react';
import { ChatMessage, ParsedQueryType } from '../types/general';

type ValuesContextType = {
  conversation: ChatMessage[];
  isChatOpen: boolean;
  isHistoryTab: boolean;
  tooltipText: string;
  threadId: string;
  submittedQuery: { parsed: ParsedQueryType[]; plain: string };
  selectedLines: [number, number] | null;
};

type SettersContextType = {
  setConversation: Dispatch<SetStateAction<ChatMessage[]>>;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  setIsHistoryTab: Dispatch<SetStateAction<boolean>>;
  setTooltipText: Dispatch<SetStateAction<string>>;
  setThreadId: Dispatch<SetStateAction<string>>;
  setSubmittedQuery: Dispatch<
    SetStateAction<{ parsed: ParsedQueryType[]; plain: string }>
  >;
  setSelectedLines: Dispatch<SetStateAction<[number, number] | null>>;
};

export const ChatContext = {
  Values: createContext<ValuesContextType>({
    conversation: [],
    isChatOpen: false,
    isHistoryTab: false,
    tooltipText: '',
    submittedQuery: { parsed: [], plain: '' },
    threadId: '',
    selectedLines: null,
  }),
  Setters: createContext<SettersContextType>({
    setConversation: () => {},
    setChatOpen: () => {},
    setTooltipText: () => {},
    setSubmittedQuery: () => {},
    setThreadId: () => {},
    setSelectedLines: () => {},
    setIsHistoryTab: () => {},
  }),
};
