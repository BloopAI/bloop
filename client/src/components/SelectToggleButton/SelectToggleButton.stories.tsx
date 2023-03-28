import { useState } from 'react';
import { MailIcon } from '../../icons';
import SelectToggleButton from './index';
import '../../index.css';

export default {
  title: 'components/SelectToggleButton',
  component: SelectToggleButton,
};

export const Default = () => {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="gap-4 grid grid-cols-4-fit justify-items-start justify-center text-gray-100 items-center bg-gray-900">
      <SelectToggleButton
        selected={selected === 1}
        onClick={() => setSelected(1)}
        onlyIcon
        title="Mail"
      >
        <MailIcon />
      </SelectToggleButton>
      <SelectToggleButton
        selected={selected === 2}
        onClick={() => setSelected(2)}
        onlyIcon
        title="Mail"
      >
        <MailIcon />
      </SelectToggleButton>
      <SelectToggleButton
        selected={selected === 3}
        onClick={() => setSelected(3)}
        onlyIcon
        title="Mail"
      >
        <MailIcon />
      </SelectToggleButton>
    </div>
  );
};
