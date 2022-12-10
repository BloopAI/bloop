import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import Tippy, { TippyProps } from '@tippyjs/react/headless';
import {
  TooltipTailTop,
  TooltipTailBottom,
  TooltipTailLeft,
  TooltipTailRight,
} from '../../icons';

type Props = {
  text: string | React.ReactNode;
  placement: TippyProps['placement'];
};

const positionsMap = {
  auto: 'flex-col-reverse items-start',
  'auto-start': 'flex-col-reverse items-start',
  'auto-end': 'flex-col-reverse items-end',
  'top-start': 'flex-col-reverse items-start',
  top: ' flex-col-reverse items-center',
  'top-end': 'flex-col-reverse items-end',
  'bottom-start': 'flex-col items-start',
  bottom: 'flex-col items-center',
  'bottom-end': 'flex-col items-end',
  left: 'flex-row-reverse items-center',
  'left-start': 'flex-row-reverse items-center',
  'left-end': 'flex-row-reverse items-center',
  right: 'items-center',
  'right-start': 'items-center',
  'right-end': 'items-center',
};

const getTail = (orientation: Props['placement']) => {
  let tooltip;
  switch (orientation) {
    case 'left':
    case 'left-start':
      tooltip = <TooltipTailRight raw />;
      break;
    case 'bottom':
    case 'bottom-start':
    case 'bottom-end':
      tooltip = <TooltipTailTop raw />;
      break;
    case 'right':
    case 'right-start':
      tooltip = <TooltipTailLeft raw />;
      break;
    case 'top':
    case 'top-start':
    case 'top-end':
      tooltip = <TooltipTailBottom raw />;
      break;
  }

  return tooltip;
};

const tailWidth = 12;

const Tooltip = ({ text, placement, children }: PropsWithChildren<Props>) => {
  const ref = useRef<HTMLDivElement>(null);
  const [childCenter, setChildCenter] = useState(10);
  useEffect(() => {
    setChildCenter((ref.current?.clientWidth || 20) / 2);
  }, [children]);
  return (
    <Tippy
      placement={placement}
      render={(attrs) => (
        <span
          {...attrs}
          className={`flex w-fit group-custom-hover:visible z-50 ${
            positionsMap[attrs['data-placement']]
          }`}
        >
          <span
            className={`text-gray-700`}
            style={
              attrs['data-placement']?.startsWith('top') ||
              attrs['data-placement']?.startsWith('bottom')
                ? attrs['data-placement']?.endsWith('start')
                  ? { marginLeft: childCenter - tailWidth / 2 }
                  : attrs['data-placement']?.endsWith('end')
                  ? { marginRight: childCenter - tailWidth / 2 }
                  : {}
                : {}
            }
          >
            {getTail(attrs['data-placement'])}
          </span>
          <span
            className={`inline-block w-max px-3 py-2 w-fit bg-gray-700 rounded text-center text-gray-300 text-xs`}
          >
            {text}
          </span>
        </span>
      )}
    >
      <div ref={ref}>{children}</div>
    </Tippy>
  );
};
export default Tooltip;
