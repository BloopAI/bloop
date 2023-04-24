import { createContext, Dispatch, SetStateAction } from 'react';
import { ChatMessage } from '../types/general';

type ContextType = {
  conversation: ChatMessage[];
  setConversation: Dispatch<SetStateAction<ChatMessage[]>>;
  isChatOpen: boolean;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
};

export const ChatContext = createContext<ContextType>({
  conversation: [],
  setConversation: () => {},
  isChatOpen: false,
  setChatOpen: () => {},
});
