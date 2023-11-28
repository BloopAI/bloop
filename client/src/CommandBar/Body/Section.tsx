import { Dispatch, memo, SetStateAction } from 'react';
import { CommandBarItemType, CommandBarStepType } from '../../types/general';
import SectionDivider from './SectionDivider';
import Item from './Item';

type Props = {
  title: string;
  items: CommandBarItemType[];
  focusedIndex: number;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  offset: number;
};

const CommandBarBodySection = ({
  title,
  items,
  setFocusedIndex,
  offset,
  focusedIndex,
}: Props) => {
  return (
    <div className="flex flex-col">
      <SectionDivider text={title} />
      {items.map(({ key, ...Rest }, i) =>
        'Component' in Rest ? (
          <Rest.Component
            {...Rest.componentProps}
            key={key}
            isFocused={focusedIndex === i + offset}
            setFocusedIndex={setFocusedIndex}
            isFirst={i === 0}
            i={i + offset}
          />
        ) : (
          <Item
            key={key}
            {...Rest}
            i={i + offset}
            isFocused={focusedIndex === i + offset}
            setFocusedIndex={setFocusedIndex}
            isFirst={i === 0}
          />
        ),
      )}
    </div>
  );
};

export default memo(CommandBarBodySection);
