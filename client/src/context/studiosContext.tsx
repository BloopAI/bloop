import { createContext, Dispatch, SetStateAction } from 'react';
import { ChatMessage, InputValueType, ParsedQueryType } from '../types/general';

export type StudioContext = {
  conversation: ChatMessage[];
  setConversation: Dispatch<SetStateAction<ChatMessage[]>>;
  inputValue: InputValueType;
  setInputValue: Dispatch<SetStateAction<InputValueType>>;
  selectedLines: [number, number] | null;
  setSelectedLines: Dispatch<SetStateAction<[number, number] | null>>;
  submittedQuery: InputValueType;
  setSubmittedQuery: Dispatch<SetStateAction<InputValueType>>;
  isLoading: boolean;
  hideMessagesFrom: null | number;
  queryIdToEdit: string;
  inputImperativeValue: Record<string, any> | null;
  threadId: string;
  setThreadId: Dispatch<SetStateAction<string>>;
  stopGenerating: () => void;
  onMessageEditCancel: () => void;
  onMessageEdit: (parentQueryId: string, i: number) => void;
  setInputValueImperatively: (value: ParsedQueryType[] | string) => void;
  isDeprecatedModalOpen: boolean;
  closeDeprecatedModal: () => void;
};

type ContextType = {
  studios: Record<string, StudioContext>;
  setStudios: Dispatch<SetStateAction<Record<string, StudioContext>>>;
};

export const StudiosContext = createContext<ContextType>({
  studios: {},
  setStudios: () => {},
});
