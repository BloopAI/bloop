import { memo, useContext, useEffect, useMemo } from 'react';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import DropdownSection from '../../../components/Dropdown/Section';
import { CommandBarContext } from '../../../context/commandBarContext';

type Props = {
  handleClose: () => void;
};

const ActionsDropDown = ({ handleClose }: Props) => {
  const { focusedItem } = useContext(CommandBarContext.FooterValues);

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

  return (
    <div>
      {!!focusedDropdownItems.length &&
        focusedDropdownItems.map(
          (section: { items: Record<string, any>[]; key: string }) => (
            <DropdownSection key={section.key}>
              {section.items.map((item: Record<string, any>) => (
                <SectionItem
                  color="base"
                  shortcut={item.shortcut}
                  key={item.key}
                  onClick={item.onClick}
                  label={item.label}
                  icon={item.icon}
                  index={item.key}
                />
              ))}
            </DropdownSection>
          ),
        )}
    </div>
  );
};

export default memo(ActionsDropDown);
