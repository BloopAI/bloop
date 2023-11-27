import { Dispatch, memo, SetStateAction } from 'react';
import { CommandBarItemType, CommandBarStepType } from '../../types/general';
import SectionDivider from './SectionDivider';
import Item from './Item';

type Props = {
  title: string;
  items: CommandBarItemType[];
  setFocusedItem: Dispatch<SetStateAction<CommandBarItemType | null>>;
  focusedIndex: number;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  offset: number;
  setActiveStep: Dispatch<SetStateAction<CommandBarStepType>>;
};

const CommandBarBodySection = ({
  title,
  items,
  setFocusedItem,
  setFocusedIndex,
  offset,
  focusedIndex,
  setActiveStep,
}: Props) => {
  return (
    <div className="flex flex-col">
      <SectionDivider text={title} />
      {items.map((item, i) => (
        <Item
          key={i}
          {...item}
          i={i + offset}
          setFocusedItem={setFocusedItem}
          isFocused={focusedIndex === i + offset}
          setFocusedIndex={setFocusedIndex}
          setActiveStep={setActiveStep}
          isFirst={i === 0}
        />
      ))}
    </div>
  );
};

export default memo(CommandBarBodySection);
