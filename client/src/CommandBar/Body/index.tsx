import { memo, useEffect } from 'react';
import { CommandBarSectionType } from '../../types/general';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import { useArrowNavigation } from '../../hooks/useArrowNavigation';
import Section from './Section';

type Props = {
  sections: CommandBarSectionType[];
  disableKeyNav?: boolean;
  onFocusedIndexChange?: (i: string) => void;
};

const CommandBarBody = ({
  sections,
  disableKeyNav,
  onFocusedIndexChange,
}: Props) => {
  const { focusedIndex, setFocusedIndex, handleArrowKey, navContainerRef } =
    useArrowNavigation();

  useEffect(() => {
    if (onFocusedIndexChange) {
      onFocusedIndexChange(focusedIndex);
    }
  }, [focusedIndex]);

  useKeyboardNavigation(handleArrowKey, disableKeyNav);

  return (
    <div
      className="flex flex-col gap-1 flex-1 w-full p-2 overflow-auto show-scrollbar"
      ref={navContainerRef}
    >
      {sections.map((s) => (
        <Section
          key={s.key}
          title={s.label}
          items={s.items}
          focusedIndex={focusedIndex}
          setFocusedIndex={setFocusedIndex}
          disableKeyNav={disableKeyNav}
          index={s.key}
        />
      ))}
    </div>
  );
};

export default memo(CommandBarBody);
