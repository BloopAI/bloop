import React, { useEffect, useRef, useState } from 'react';
import { TippyProps } from '@tippyjs/react';
import { useTranslation } from 'react-i18next';
import { ChevronDownFilled, ChevronUpFilled } from '../../../icons';
import ContextMenu, { ContextMenuItem } from '../../ContextMenu';
import Button from '../../Button';
import { useOnClickOutside } from '../../../hooks/useOnClickOutsideHook';

type Props = {
  items: ContextMenuItem[];
  hint?: string;
  icon: React.ReactElement;
  dropdownBtnClassName?: string;
  btnTitle?: string;
  noChevron?: boolean;
  btnVariant?: 'primary' | 'secondary' | 'tertiary' | 'tertiary-disabled';
  btnSize?: 'small' | 'medium' | 'large' | 'tiny';
  btnOnlyIcon?: boolean;
  lastItemFixed?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  dropdownPlacement?: TippyProps['placement'];
  appendTo?: TippyProps['appendTo'];
  onClose?: () => void;
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
  appendTo = 'parent',
  btnTitle,
  disabled,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const [visible, setVisibility] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () =>
    appendTo === 'parent' ? setVisibility(false) : {},
  );

  useEffect(() => {
    if (!visible && onClose) {
      onClose();
    }
  }, [visible, onClose]);

  return (
    <div className="relative" ref={ref}>
      <ContextMenu
        items={items}
        visible={visible}
        title={hint}
        handleClose={() => setVisibility(false)}
        closeOnClickOutside
        lastItemFixed={lastItemFixed}
        size={size}
        dropdownPlacement={dropdownPlacement}
        appendTo={appendTo}
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
          disabled={disabled}
          onlyIcon={btnOnlyIcon}
          title={btnTitle || t('Open dropdown')}
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
