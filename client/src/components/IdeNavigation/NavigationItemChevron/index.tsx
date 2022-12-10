import React, { useState } from 'react';
import TextField from '../../TextField';
import {
  ChevronDownFilled,
  ChevronRightFilled,
  FolderFilled,
} from '../../../icons';

type Props = {
  value: string;
  active?: boolean;
  onClick?: any;
};

const NavigationItemChevron = ({ value, active, onClick }: Props) => {
  const [clicked, setClicked] = useState(active);
  return (
    <span
      className="px-7 block py-2 hover:text-gray-300 hover:bg-gray-800 cursor-pointer flex items-center gap-2 w-full text-gray-500"
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
