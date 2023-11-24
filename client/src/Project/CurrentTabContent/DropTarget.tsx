import { memo } from 'react';
import { useDrop } from 'react-dnd';
import { Trans, useTranslation } from 'react-i18next';
import { TabType } from '../../types/general';
import { SplitViewIcon } from '../../icons';

type Props = {
  onDrop: (t: TabType) => void;
};

const DropTarget = ({ onDrop }: Props) => {
  useTranslation();
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: 'tab-left',
      drop: (item: { t: TabType }, monitor) => {
        onDrop(item.t);
      },
      collect: (monitor) => {
        return {
          isOver: !!monitor.isOver(),
          canDrop: !!monitor.canDrop(),
        };
      },
    }),
    [onDrop],
  );

  return (
    <div
      className={`absolute top-10 right-0 w-1/2 bottom-0 ${
        isOver && canDrop ? 'bg-bg-sub' : ''
      } z-30`}
      ref={drop}
    >
      {isOver && canDrop && (
        <div className="absolute w-full h-full bg-bg-selected flex flex-col">
          <div className="h-10 border-b border-bg-border w-full" />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3 text-label-base body-s-b">
              <SplitViewIcon sizeClassName="w-4.5 h-4.5" />
              <p>
                <Trans>Release to open in split view</Trans>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(DropTarget);
