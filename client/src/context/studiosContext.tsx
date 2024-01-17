import { createContext, Dispatch, SetStateAction } from 'react';
import {
  StudioConversationMessage,
  StudioConversationMessageAuthor,
} from '../types/general';
import { GeneratedCodeDiff } from '../types/api';

export type StudioContext = {
  conversation: StudioConversationMessage[];
  setConversation: Dispatch<SetStateAction<StudioConversationMessage[]>>;
  inputValue: string;
  setInputValue: Dispatch<SetStateAction<string>>;
  tokenCount: number;
  setTokenCount: Dispatch<SetStateAction<number>>;
  onMessageChange: (message: string, i?: number) => void;
  onMessageRemoved: (i: number, andSubsequent?: boolean) => void;
  diff: GeneratedCodeDiff | null;
  onDiffRemoved: (i: number) => void;
  onDiffChanged: (i: number, v: string) => void;
  isDiffApplyError: boolean;
  isDiffApplied: boolean;
  waitingForDiff: boolean;
  isDiffGenFailed: boolean;
  inputAuthor: StudioConversationMessageAuthor;
  onSubmit: () => void;
  isLoading: boolean;
  handleCancel: () => void;
  clearConversation: () => void;
};

type ContextType = {
  studios: Record<string, StudioContext>;
  setStudios: Dispatch<SetStateAction<Record<string, StudioContext>>>;
};

export const StudiosContext = createContext<ContextType>({
  studios: {},
  setStudios: () => {},
});
