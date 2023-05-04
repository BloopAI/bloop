import React, { useRef, useState } from 'react';
import { TippyProps } from '@tippyjs/react';
import { ChevronDownFilled, ChevronUpFilled } from '../../../icons';
import ContextMenu, { ContextMenuItem } from '../../ContextMenu';
import Button from '../../Button';
import { useOnClickOutside } from '../../../hooks/useOnClickOutsideHook';

type Props = {
  items: ContextMenuItem[];
  hint?: string;
  icon: React.ReactElement;
  dropdownBtnClassName?: string;
  noChevron?: boolean;
  btnVariant?: 'primary' | 'secondary' | 'tertiary';
  btnSize?: 'small' | 'medium' | 'large' | 'tiny';
  btnOnlyIcon?: boolean;
  lastItemFixed?: boolean;
  size?: 'small' | 'medium' | 'large';
  dropdownPlacement?: TippyProps['placement'];
};

const Dropdown = ({
  items,
  hint,
  icon,
  dropdownBtnClassName,
  noChevron,
  btnVariant = 'tertiary',
  btnSize = 'medium',
  btnOnlyIcon,
  lastItemFixed,
  size = 'medium',
  dropdownPlacement = 'bottom-start',
}: Props) => {
  const [visible, setVisibility] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setVisibility(false));

  return (
    <div className="relative" ref={ref}>
      <ContextMenu
        items={items}
        visible={visible}
        title={hint}
        handleClose={() => setVisibility(false)}
        closeOnClickOutside={false}
        lastItemFixed={lastItemFixed}
        size={size}
        dropdownPlacement={dropdownPlacement}
      >
        <Button
          variant={btnVariant}
          size={btnSize}
          id="dropdownDefault"
          data-dropdown-toggle="dropdown"
          className={`${visible ? 'text-label-title' : ''} ${
            dropdownBtnClassName || ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setVisibility(!visible);
          }}
          onlyIcon={btnOnlyIcon}
          title="Open dropdown"
        >
          {icon}
          {noChevron ? null : visible ? (
            <ChevronUpFilled />
          ) : (
            <ChevronDownFilled />
          )}
        </Button>
      </ContextMenu>
    </div>
  );
};

export default Dropdown;
