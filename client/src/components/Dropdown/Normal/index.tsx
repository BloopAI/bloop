import React, { useState } from 'react';
import { ChevronDownFilled, ChevronUpFilled } from '../../../icons';
import TextField from '../../TextField';
import ContextMenu, { ContextMenuItem } from '../../ContextMenu';
import Button from '../../Button';

type Props = {
  items: ContextMenuItem[];
  hint?: string;
  btnHint?: string;
  selected?: ContextMenuItem;
};

const Dropdown = ({ items, hint, selected, btnHint }: Props) => {
  const [visible, setVisibility] = useState(false);
  const [selectedItem, setSelectedItem] = useState(selected);

  const handleSelect = (item: ContextMenuItem) => {
    setSelectedItem(item);
    setVisibility(false);
  };

  return (
    <div className="relative select-none">
      <ContextMenu
        items={items}
        visible={visible}
        title={hint}
        handleClose={() => setVisibility(false)}
      >
        <Button
          variant="secondary"
          size="medium"
          onClick={() => setVisibility(!visible)}
        >
          {btnHint ? <span className="text-gray-500">{btnHint}</span> : null}
          {selectedItem ? (
            <TextField value={selectedItem.text!} icon={selectedItem.icon} />
          ) : (
            <TextField value={items[0].text!} icon={items[0].icon} />
          )}

          <span>{visible ? <ChevronUpFilled /> : <ChevronDownFilled />}</span>
        </Button>
      </ContextMenu>
    </div>
  );
};
export default Dropdown;
