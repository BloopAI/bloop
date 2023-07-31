import React, { createContext } from 'react';
import { FileHighlightsType } from '../types/general';

type ContextType = {
  fileHighlights: FileHighlightsType;
  setFileHighlights: React.Dispatch<React.SetStateAction<FileHighlightsType>>;
};

export const FileHighlightsContext = createContext<ContextType>({
  fileHighlights: {},
  setFileHighlights: () => {},
});
