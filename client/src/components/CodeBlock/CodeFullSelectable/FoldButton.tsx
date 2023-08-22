import React, { useState } from 'react';
import { ChevronDownFilled, ChevronRightFilled } from '../../../icons';

type Props = {
  onClick: (folded: boolean) => any;
};
const FoldButton = ({ onClick }: Props) => {
  const [folded, setFolded] = useState(false);

  const handleClick = (e: any) => {
    setFolded(!folded);
    onClick(folded);
  };

  return (
    <span
      className={`cursor-pointer flex transition-all duration-150 ease-in-bounce ${
        folded ? 'opacity-100' : 'group-hover:opacity-100 opacity-0'
      }`}
      onClick={handleClick}
    >
      {folded ? <ChevronRightFilled /> : <ChevronDownFilled />}
    </span>
  );
};

export default FoldButton;
