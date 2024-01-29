import { memo, useContext, useMemo } from 'react';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import DropdownSection from '../../../components/Dropdown/Section';
import { CommandBarContext } from '../../../context/commandBarContext';

type Props = {};

const ActionsDropDown = ({}: Props) => {
  const { focusedItem } = useContext(CommandBarContext.FooterValues);

  const focusedDropdownItems = useMemo(() => {
    return (
      (focusedItem &&
        'focusedItemProps' in focusedItem &&
        focusedItem.focusedItemProps?.dropdownItems) ||
      []
    );
  }, [focusedItem]);

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
                  index={item.key}
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
