import { createContext, Dispatch, SetStateAction } from 'react';
import { ChatMessage } from '../types/general';

type ContextType = {
  conversation: ChatMessage[];
  setConversation: Dispatch<SetStateAction<ChatMessage[]>>;
};

export const ChatContext = createContext<ContextType>({
  conversation: [],
  setConversation: () => {},
});
