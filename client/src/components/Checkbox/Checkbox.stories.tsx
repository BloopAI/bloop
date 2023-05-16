import { useState } from 'react';
import Checkbox from './index';

export default {
  title: 'components/Checkbox',
  component: Checkbox,
};

export const WithDescription = () => {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        label="Add label"
        description="Add description"
        checked={checked}
        onChange={setChecked}
      />
      <Checkbox
        label="Intermediary"
        description="Intermediary"
        checked={checked}
        onChange={setChecked}
        intermediary
      />
    </div>
  );
};

export const WithoutDescription = () => {
  const [checked, setChecked] = useState(false);
  return (
    <div>
      <Checkbox label="Add label" checked={checked} onChange={setChecked} />
    </div>
  );
};

export const Disabled = () => {
  return (
    <div>
      <Checkbox
        label="Add label"
        description="Add description"
        disabled
        checked={false}
        onChange={() => {}}
      />
    </div>
  );
};
