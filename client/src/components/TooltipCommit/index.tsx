import React, { ReactElement, useCallback, useRef, useState } from 'react';
import { format } from 'date-fns';
import Tippy, { TippyProps } from '@tippyjs/react/headless';
import { Commit } from '../../icons';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { useOnScrollHook } from '../../hooks/useOnScrollHook';

type Props = {
  position: 'left' | 'center' | 'right';
  image: string;
  name: string;
  message: string;
  date: number;
  children: React.ReactNode;
  showOnClick?: boolean;
};

const positionMap = {
  left: { tail: 'left-1', fixBorder: 'left-[8.23px]' },
  center: {
    tail: 'left-1/2 -translate-x-1/2',
    fixBorder: 'left-[13px] left-1/2 -translate-x-1/2 transform',
  },
  right: { tail: 'right-2', fixBorder: 'right-[12.3px]' },
};

const tooltipPositionMap = {
  left: '-start',
  right: '-end',
  center: '',
};

const TooltipCommit = ({
  position,
  message,
  name,
  image,
  date,
  children,
  showOnClick,
}: Props) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setVisible(false));
  useOnScrollHook(() => {
    setVisible(false);
  });
  const handleClick = useCallback(() => {
    if (showOnClick) {
      setVisible(!visible);
    }
  }, [showOnClick]);

  return (
    <Tippy
      placement={
        `top${tooltipPositionMap[position]}` as TippyProps['placement']
      }
      visible={showOnClick ? visible : undefined}
      ref={ref}
      offset={[-5, 6]}
      render={() => (
        <div className="relative pb-[5px] w-fit">
          <div
            className={`text-gray-500 rounded-4 border border-gray-700 w-fit flex relative z-10 bg-gray-800`}
          >
            <div className="flex flex-col">
              <div className="flex flex-col gap-2 py-3 px-2 text-gray-300 text-xs">
                <span className="flex flex-row gap-2 items-center">
                  <img className="w-5" src={image} />
                  <span>{name}</span>
                </span>
                <span className="flex flex-row gap-2 items-center">
                  <Commit />
                  <span>{message}</span>
                </span>
              </div>
              <span className="border-t border-gray-700 py-3 px-2 text-gray-400 text-xs">
                Committed on {format(date, 'd MMM, y')}
              </span>
            </div>
            <span
              className={`absolute bottom-[-1px] ${positionMap[position].fixBorder} w-[9.52px] h-[1px] bg-gray-800 border-t-[1px] border-l-[1px] border-r-[1px] border-t-transparent border-l-gray-700 border-r-gray-700`}
            />
          </div>
          <span
            className={`absolute bottom-1 ${positionMap[position].tail} w-5 h-5 border border-gray-700 bg-gray-800 transform rotate-45 box-border z-0 rounded-sm`}
          />
        </div>
      )}
    >
      <span onClick={handleClick}>{children as ReactElement}</span>
    </Tippy>
  );
};
export default TooltipCommit;
