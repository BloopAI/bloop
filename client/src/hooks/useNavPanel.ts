import {
  Dispatch,
  MouseEvent,
  SetStateAction,
  useCallback,
  useEffect,
} from 'react';
import { useArrowNavigationItemProps } from './useArrowNavigationItemProps';

export const useNavPanel = (
  index: string,
  setExpanded: Dispatch<SetStateAction<string>>,
  isExpanded: boolean,
) => {
  const onClick = useCallback(() => {
    setExpanded((prev) => (prev === index ? '' : index));
  }, [index]);

  useEffect(() => {
    if (isExpanded) {
      // containerRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isExpanded]);

  const noPropagate = useCallback((e?: MouseEvent) => {
    e?.stopPropagation();
  }, []);

  const { isFocused, isLeftSidebarFocused, props } =
    useArrowNavigationItemProps<HTMLAnchorElement>(index, onClick);

  return {
    noPropagate,
    itemProps: {
      ...props,
      className: `h-10 flex items-center gap-3 px-4 ellipsis ${
        isExpanded ? 'sticky z-10 top-0 left-0' : ''
      } ${
        isFocused ? 'bg-bg-sub-hover' : 'bg-bg-sub'
      } outline-0 outline-none focus:outline-0 focus:outline-none`,
      tabIndex: 0,
      role: 'button',
    },
  };
};
