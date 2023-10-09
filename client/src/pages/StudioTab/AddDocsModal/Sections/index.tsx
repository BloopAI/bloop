import React, { memo, useCallback, useState } from 'react';
import { DocSectionType, DocShortType } from '../../../../types/api';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import SectionItem from './SectionItem';

type Props = {
  filteredSections: DocSectionType[];
  selectedProvider: DocShortType;
  handleDocSubmit: (
    docProvider: DocShortType,
    url: string,
    title: string,
    selectedSection?: string,
  ) => void;
};

const Sections = ({
  filteredSections,
  selectedProvider,
  handleDocSubmit,
}: Props) => {
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          handleDocSubmit(
            selectedProvider,
            filteredSections[highlightedIndex].relative_url,
            filteredSections[highlightedIndex].point_id,
          );
        }
      } else {
        if (e.key === 'ArrowDown') {
          setHighlightedIndex((prev) =>
            prev < filteredSections.length - 1 ? prev + 1 : 0,
          );
        } else if (e.key === 'ArrowUp') {
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredSections.length - 1,
          );
        }
      }
    },
    [filteredSections, highlightedIndex],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div className="w-full break-wordflex flex-col">
      {filteredSections.map((s, i) => (
        <SectionItem
          key={s.point_id}
          {...s}
          selectedProvider={selectedProvider}
          handleDocSubmit={handleDocSubmit}
          isFocused={highlightedIndex === i}
          i={i}
          setHighlightedIndex={setHighlightedIndex}
        />
      ))}
    </div>
  );
};

export default memo(Sections);
