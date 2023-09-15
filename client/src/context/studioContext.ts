import { createContext, Dispatch, SetStateAction } from 'react';
import { StudioTemplateType } from '../types/api';

type InputContextType = {
  inputValue: string;
};
type TemplatesContextType = {
  templates: StudioTemplateType[];
};

type SettersContextType = {
  setInputValue: Dispatch<SetStateAction<string>>;
  setTemplates: Dispatch<SetStateAction<StudioTemplateType[]>>;
  refetchTemplates: () => void;
};

export const StudioContext = {
  Input: createContext<InputContextType>({
    inputValue: '',
  }),
  Templates: createContext<TemplatesContextType>({
    templates: [],
  }),
  Setters: createContext<SettersContextType>({
    setInputValue: () => {},
    setTemplates: () => {},
    refetchTemplates: () => {},
  }),
};
