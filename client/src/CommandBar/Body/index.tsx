import { memo, useEffect, useMemo } from 'react';
import { CommandBarSectionType } from '../../types/general';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import { useArrowNavigation } from '../../hooks/useArrowNavigation';
import { ArrowNavigationContext } from '../../context/arrowNavigationContext';
import { noOp } from '../../utils';
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
    if (sections?.[0]?.items?.[0]) {
      setFocusedIndex(`${sections[0].key}-${sections[0].items[0].key}`);
    }
  }, [sections]);

  useEffect(() => {
    if (onFocusedIndexChange) {
      onFocusedIndexChange(focusedIndex);
    }
  }, [focusedIndex]);

  useKeyboardNavigation(handleArrowKey, disableKeyNav);

  const contextValue = useMemo(
    () => ({
      focusedIndex,
      setFocusedIndex,
      handleClose: noOp,
    }),
    [focusedIndex],
  );

  return (
    <div
      className="flex flex-col gap-1 flex-1 w-full p-2 overflow-auto show-scrollbar"
      ref={navContainerRef}
    >
      <ArrowNavigationContext.Provider value={contextValue}>
        {sections.map((s) => (
          <Section
            key={s.key}
            title={s.label}
            items={s.items}
            disableKeyNav={disableKeyNav}
            index={s.key}
          />
        ))}
      </ArrowNavigationContext.Provider>
    </div>
  );
};

export default memo(CommandBarBody);
