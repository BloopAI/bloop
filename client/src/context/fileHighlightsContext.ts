import React, { createContext } from 'react';
import { FileHighlightsType } from '../types/general';

type ContextTypeValues = {
  fileHighlights: FileHighlightsType;
  hoveredLines: [number, number] | null;
};
type ContextTypeSetters = {
  setFileHighlights: React.Dispatch<React.SetStateAction<FileHighlightsType>>;
  setHoveredLines: React.Dispatch<
    React.SetStateAction<[number, number] | null>
  >;
};

export const FileHighlightsContext = {
  Values: createContext<ContextTypeValues>({
    fileHighlights: {},
    hoveredLines: null,
  }),
  Setters: createContext<ContextTypeSetters>({
    setFileHighlights: () => {},
    setHoveredLines: () => {},
  }),
};
