import { memo, useCallback, useEffect, useState } from 'react';
import { CommandBarSectionType } from '../../types/general';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import Section from './Section';

type Props = {
  sections: CommandBarSectionType[];
  disableKeyNav?: boolean;
};

const CommandBarBody = ({ sections, disableKeyNav }: Props) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    setFocusedIndex(0);
  }, [sections]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev <
          sections.reduce((prev, curr) => prev + curr.items.length, 0) - 1
            ? prev + 1
            : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev > 0
            ? prev - 1
            : sections.reduce((prev, curr) => prev + curr.items.length, 0) - 1,
        );
      }
    },
    [sections],
  );
  useKeyboardNavigation(handleKeyEvent, disableKeyNav);

  return (
    <div className="flex flex-col gap-1 flex-1 w-full p-2 overflow-auto show-scrollbar">
      {sections.map((s) => (
        <Section
          key={s.key}
          title={s.label}
          items={s.items}
          focusedIndex={focusedIndex}
          setFocusedIndex={setFocusedIndex}
          offset={s.itemsOffset}
          disableKeyNav={disableKeyNav}
        />
      ))}
    </div>
  );
};

export default memo(CommandBarBody);
