import { useState } from 'react';
import TextInput from './index';
import '../../index.css';

export default {
  title: 'components/TextInput',
  component: TextInput,
};

export const DefaultOutlined = () => {
  const [value, setValue] = useState('');
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextInput
        label="Add label"
        placeholder="Placeholder"
        helperText="Helper text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        name="storybook"
        type="email"
      />
    </div>
  );
};

export const InputErrorOutlined = () => {
  const [value, setValue] = useState('');
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextInput
        label="Add label"
        placeholder="Placeholder"
        helperText="Helper text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        name="storybook"
        error="Error message"
        type="email"
      />
    </div>
  );
};

export const InputSuccessOutlined = () => {
  const [value, setValue] = useState('Placeholder');
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextInput
        label="Add label"
        placeholder="Placeholder"
        helperText="Helper text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        name="storybook"
        success={!!value}
        type="email"
      />
    </div>
  );
};

export const DisabledOutlined = () => {
  const [value, setValue] = useState('');
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextInput
        label="Add label"
        placeholder="Placeholder"
        helperText="Helper text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        name="storybook"
        disabled
        type="email"
      />
    </div>
  );
};

export const DefaultFilled = () => {
  const [value, setValue] = useState('');
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextInput
        label="Add label"
        placeholder="Placeholder"
        helperText="Helper text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        name="storybook"
        variant="filled"
        type="email"
      />
    </div>
  );
};

export const InputErrorFilled = () => {
  const [value, setValue] = useState('');
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextInput
        label="Add label"
        placeholder="Placeholder"
        helperText="Helper text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        name="storybook"
        error="Error message"
        variant="filled"
        type="email"
      />
    </div>
  );
};

export const InputSuccessFilled = () => {
  const [value, setValue] = useState('Placeholder');
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextInput
        label="Add label"
        placeholder="Placeholder"
        helperText="Helper text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        name="storybook"
        success={!!value}
        variant="filled"
        type="email"
      />
    </div>
  );
};

export const DisabledFilled = () => {
  const [value, setValue] = useState('');
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextInput
        label="Add label"
        placeholder="Placeholder"
        helperText="Helper text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        name="storybook"
        disabled
        variant="filled"
        type="email"
      />
    </div>
  );
};
