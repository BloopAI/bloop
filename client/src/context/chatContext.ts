import { createContext, Dispatch, SetStateAction } from 'react';
import { ChatMessage } from '../types/general';

type ValuesContextType = {
  conversation: ChatMessage[];
  isChatOpen: boolean;
  showTooltip: boolean;
  tooltipText: string;
  threadId: string;
  submittedQuery: string;
  selectedLines: [number, number] | null;
};

type SettersContextType = {
  setConversation: Dispatch<SetStateAction<ChatMessage[]>>;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  setShowTooltip: Dispatch<SetStateAction<boolean>>;
  setTooltipText: Dispatch<SetStateAction<string>>;
  setThreadId: Dispatch<SetStateAction<string>>;
  setSubmittedQuery: Dispatch<SetStateAction<string>>;
  setSelectedLines: Dispatch<SetStateAction<[number, number] | null>>;
};

export const ChatContext = {
  Values: createContext<ValuesContextType>({
    conversation: [],
    isChatOpen: false,
    showTooltip: false,
    tooltipText: '',
    submittedQuery: '',
    threadId: '',
    selectedLines: null,
  }),
  Setters: createContext<SettersContextType>({
    setConversation: () => {},
    setChatOpen: () => {},
    setShowTooltip: () => {},
    setTooltipText: () => {},
    setSubmittedQuery: () => {},
    setThreadId: () => {},
    setSelectedLines: () => {},
  }),
};
