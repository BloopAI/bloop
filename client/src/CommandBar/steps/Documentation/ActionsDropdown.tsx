import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import DropdownSection from '../../../components/Dropdown/Section';
import { CommandBarContext } from '../../../context/commandBarContext';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';

type Props = {
  handleClose: () => void;
};

const ActionsDropDown = ({ handleClose }: Props) => {
  const { focusedItem } = useContext(CommandBarContext.FooterValues);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const focusedDropdownItems = useMemo(() => {
    return (
      (focusedItem &&
        'focusedItemProps' in focusedItem &&
        focusedItem.focusedItemProps?.dropdownItems) ||
      []
    );
  }, [focusedItem]);

  const focusedDropdownItemsLength = useMemo(() => {
    return focusedDropdownItems.reduce(
      (prev: number, curr: { items: Record<string, any>[]; key: string }) =>
        prev + curr.items.length,
      0,
    );
  }, [focusedDropdownItems]);

  useEffect(() => {
    if (!focusedDropdownItemsLength) {
      handleClose();
    }
  }, [focusedDropdownItemsLength]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev < focusedDropdownItemsLength - 1 ? prev + 1 : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : focusedDropdownItemsLength - 1,
        );
      } else if (e.key === 'Enter') {
        let currentIndex = 0;

        for (let i = 0; i < focusedDropdownItems.length; i++) {
          for (let j = 0; j < focusedDropdownItems[i].items.length; j++) {
            if (currentIndex === focusedIndex) {
              return focusedDropdownItems[i].items[j].onClick();
            }
            currentIndex++;
          }
        }
      }
    },
    [focusedIndex, focusedDropdownItems, focusedDropdownItemsLength],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div>
      {!!focusedDropdownItems.length &&
        focusedDropdownItems.map(
          (section: {
            items: Record<string, any>[];
            key: string;
            itemsOffset: number;
          }) => (
            <DropdownSection key={section.key}>
              {section.items.map((item: Record<string, any>, i: number) => (
                <SectionItem
                  color="base"
                  shortcut={item.shortcut}
                  key={item.key}
                  isFocused={focusedIndex === i + section.itemsOffset}
                  onClick={item.onClick}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </DropdownSection>
          ),
        )}
    </div>
  );
};

export default memo(ActionsDropDown);
