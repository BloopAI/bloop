import { useState } from 'react';
import Checkbox from './index';
import '../../index.css';

export default {
  title: 'components/Checkbox',
  component: Checkbox,
};

export const WithDescription = () => {
  const [checked, setChecked] = useState(false);
  return (
    <div className="bg-gray-900">
      <Checkbox
        label="Add label"
        description="Add description"
        checked={checked}
        onChange={setChecked}
      />
    </div>
  );
};

export const WithoutDescription = () => {
  const [checked, setChecked] = useState(false);
  return (
    <div className="bg-gray-900">
      <Checkbox label="Add label" checked={checked} onChange={setChecked} />
    </div>
  );
};

export const Disabled = () => {
  return (
    <div className="bg-gray-900">
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
