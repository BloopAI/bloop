import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDownFilled, ChevronUpFilled } from '../../../icons';
import TextField from '../../TextField';
import ContextMenu, { ContextMenuItem } from '../../ContextMenu';
import Button from '../../Button';
import { useOnClickOutside } from '../../../hooks/useOnClickOutsideHook';

type Props = {
  items: ContextMenuItem[];
  hint?: string;
  btnHint?: ReactNode;
  titleClassName?: string;
  btnClassName?: string;
  selected?: ContextMenuItem;
  onClose?: () => void;
};

const Dropdown = ({
  items,
  hint,
  selected,
  btnHint,
  titleClassName,
  onClose,
  btnClassName,
}: Props) => {
  const [visible, setVisibility] = useState(false);
  const [selectedItem, setSelectedItem] = useState(selected);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setVisibility(false));

  useEffect(() => {
    setSelectedItem(selected);
  }, [selected]);

  const handleSelect = (item: ContextMenuItem) => {
    setSelectedItem(item);
    setVisibility(false);
  };

  useEffect(() => {
    if (!visible && onClose) {
      onClose();
    }
  }, [visible]);

  return (
    <div className="relative select-none max-w-full" ref={ref}>
      <ContextMenu
        items={items}
        visible={visible}
        title={hint}
        handleClose={() => setVisibility(false)}
        closeOnClickOutside={false}
      >
        <Button
          variant="secondary"
          size="medium"
          type="button"
          onClick={() => setVisibility(!visible)}
          className={btnClassName}
        >
          {btnHint ? (
            <span className="text-label-muted flex-1 text-left">{btnHint}</span>
          ) : null}
          {selectedItem ? (
            <TextField
              value={selectedItem.text!}
              icon={selectedItem.icon}
              className={titleClassName}
            />
          ) : (
            <TextField
              value={items[0].text!}
              icon={items[0].icon}
              className={titleClassName}
            />
          )}

          <span>{visible ? <ChevronUpFilled /> : <ChevronDownFilled />}</span>
        </Button>
      </ContextMenu>
    </div>
  );
};
export default Dropdown;
