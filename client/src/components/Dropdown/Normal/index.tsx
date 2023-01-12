import React, { useEffect, useRef, useState } from 'react';
import { ChevronDownFilled, ChevronUpFilled } from '../../../icons';
import TextField from '../../TextField';
import ContextMenu, { ContextMenuItem } from '../../ContextMenu';
import Button from '../../Button';
import { useOnClickOutside } from '../../../hooks/useOnClickOutsideHook';

type Props = {
  items: ContextMenuItem[];
  hint?: string;
  btnHint?: string;
  titleClassName?: string;
  selected?: ContextMenuItem;
};

const Dropdown = ({
  items,
  hint,
  selected,
  btnHint,
  titleClassName,
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

  return (
    <div className="relative select-none" ref={ref}>
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
          onClick={() => setVisibility(!visible)}
        >
          {btnHint ? <span className="text-gray-500">{btnHint}</span> : null}
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
