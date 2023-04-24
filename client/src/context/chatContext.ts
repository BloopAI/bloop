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
});
