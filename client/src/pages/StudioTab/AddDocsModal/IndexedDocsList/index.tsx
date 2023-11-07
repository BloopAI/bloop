import React, { memo, useCallback, useEffect, useState } from 'react';
import { CodeStudioType, DocShortType } from '../../../../types/api';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import { deleteDocProvider } from '../../../../services/api';
import IndexedDocRow from './IndexedDocRow';

type Props = {
  filteredDocs: DocShortType[];
  handleLibrarySubmit: (doc: DocShortType) => void;
  refetchDocs: () => void;
  syncDocProvider: (id: string, isResync: boolean) => void;
  refetchCodeStudio: (keyToUpdate?: keyof CodeStudioType) => Promise<void>;
};

const IndexedDocsList = ({
  filteredDocs,
  handleLibrarySubmit,
  refetchDocs,
  syncDocProvider,
  refetchCodeStudio,
}: Props) => {
  const [highlightedDocIndex, setHighlightedDocIndex] = useState(0);

  useEffect(() => {
    setHighlightedDocIndex(0);
  }, [filteredDocs.length]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'r') {
          syncDocProvider(filteredDocs[highlightedDocIndex].id, true);
        } else if (e.key === 'd') {
          deleteDocProvider(filteredDocs[highlightedDocIndex].id)
            .then(() => {
              refetchDocs();
            })
            .then(() => {
              refetchCodeStudio('token_counts'); // to check if any page is now unavailable
            });
        } else if (e.key === 'Enter') {
          handleLibrarySubmit(filteredDocs[highlightedDocIndex]);
        }
      } else {
        if (e.key === 'ArrowDown') {
          setHighlightedDocIndex((prev) =>
            prev < filteredDocs.length - 1 ? prev + 1 : 0,
          );
        } else if (e.key === 'ArrowUp') {
          setHighlightedDocIndex((prev) =>
            prev > 0 ? prev - 1 : filteredDocs.length - 1,
          );
        }
      }
    },
    [filteredDocs, highlightedDocIndex],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div className="flex flex-col gap-1 w-full items-start">
      {filteredDocs.map((d, i) => {
        return (
          <IndexedDocRow
            key={d.id}
            doc={d}
            onSubmit={handleLibrarySubmit}
            refetchDocs={refetchDocs}
            isFocused={highlightedDocIndex === i}
            syncDocProvider={syncDocProvider}
            i={i}
            setHighlightedIndex={setHighlightedDocIndex}
            refetchCodeStudio={refetchCodeStudio}
          />
        );
      })}
    </div>
  );
};

export default memo(IndexedDocsList);
