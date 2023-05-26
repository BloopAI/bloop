import React, { useState } from 'react';
import { CheckIcon } from '../../../icons';
import Button from '../../../components/Button';

const StagedBtn = ({ onClick }: { onClick: () => void }) => {
  const [isMouseOver, setMouseOver] = useState(false);
  return (
    <Button
      size="small"
      variant="primary-outlined"
      onClick={onClick}
      onMouseEnter={() => setMouseOver(true)}
      onMouseLeave={() => setMouseOver(false)}
    >
      <CheckIcon />
      {isMouseOver ? 'Unstage' : 'Staged'}
    </Button>
  );
};

export default StagedBtn;
