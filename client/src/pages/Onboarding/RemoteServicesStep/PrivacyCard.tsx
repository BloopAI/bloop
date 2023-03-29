import { ChangeEvent } from 'react';
import RadioButton from '../../../components/RadioButton';

type Props = {
  title: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  name: string;
  value: string;
  description: string;
  checked: boolean;
};

const PrivacyCard = ({
  title,
  onChange,
  name,
  value,
  checked,
  description,
}: Props) => {
  return (
    <div
      className={`p-4 border ${
        checked ? 'bg-gray-800 border-gray-800' : 'border-transparent'
      } rounded-md`}
    >
      <RadioButton
        title={title}
        checked={checked}
        onChange={onChange}
        name={name}
        value={value}
        description={description}
      />
    </div>
  );
};

export default PrivacyCard;
