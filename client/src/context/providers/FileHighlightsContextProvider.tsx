import React, { memo, PropsWithChildren, useMemo, useState } from 'react';
import { FileHighlightsContext } from '../fileHighlightsContext';
import { FileHighlightsType } from '../../types/general';

export const FileHighlightsContextProvider = memo(
  ({ children }: PropsWithChildren) => {
    const [fileHighlights, setFileHighlights] = useState<FileHighlightsType>(
      {},
    );
    const [hoveredLines, setHoveredLines] = useState<[number, number] | null>(
      null,
    );

    const valuesContextValue = useMemo(
      () => ({
        fileHighlights,
        hoveredLines,
      }),
      [fileHighlights, hoveredLines],
    );

    const settersContextValue = useMemo(
      () => ({
        setFileHighlights,
        setHoveredLines,
      }),
      [],
    );
    return (
      <FileHighlightsContext.Setters.Provider value={settersContextValue}>
        <FileHighlightsContext.Values.Provider value={valuesContextValue}>
          {children}
        </FileHighlightsContext.Values.Provider>
      </FileHighlightsContext.Setters.Provider>
    );
  },
);

FileHighlightsContextProvider.displayName = 'FileHighlightsContextProvider';
