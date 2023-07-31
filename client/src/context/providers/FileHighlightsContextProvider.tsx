import React, { PropsWithChildren, useMemo, useState } from 'react';
import { FileHighlightsContext } from '../fileHighlightsContext';
import { FileHighlightsType } from '../../types/general';

export const FileHighlightsContextProvider = ({
  children,
}: PropsWithChildren) => {
  const [fileHighlights, setFileHighlights] = useState<FileHighlightsType>({});

  const contextValue = useMemo(
    () => ({
      fileHighlights,
      setFileHighlights,
    }),
    [fileHighlights],
  );
  return (
    <FileHighlightsContext.Provider value={contextValue}>
      {children}
    </FileHighlightsContext.Provider>
  );
};
