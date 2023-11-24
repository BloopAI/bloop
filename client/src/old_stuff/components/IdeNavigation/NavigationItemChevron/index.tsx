import React, { useState } from 'react';
import TextField from '../../../../components/TextField';
import {
  ChevronDownFilled,
  ChevronRightFilled,
  FolderFilled,
} from '../../../../icons';

type Props = {
  value: string;
  active?: boolean;
  onClick?: any;
};

const NavigationItemChevron = ({ value, active, onClick }: Props) => {
  const [clicked, setClicked] = useState(active);
  return (
    <span
      className="px-7 py-2 hover:text-label-base hover:bg-bg-base-hover cursor-pointer flex items-center gap-2 w-full text-label-muted"
      onClick={(e) => {
        setClicked(!clicked);
        onClick(e);
      }}
    >
      {clicked ? <ChevronDownFilled /> : <ChevronRightFilled />}
      <TextField value={value} icon={<FolderFilled />} />
    </span>
  );
};

export default NavigationItemChevron;
