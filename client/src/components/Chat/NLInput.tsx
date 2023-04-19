import { ChangeEvent } from 'react';
import { QuillIcon } from '../../icons';

type Props = {
  id?: string;
  value?: string;
  placeholder?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
};

const NLInput = ({
  id,
  value,
  onChange,
  placeholder = 'Anything I can help you with?',
}: Props) => {
  return (
    <div
      className={`w-full flex items-center gap-2 bg-gray-800 rounded-lg disabled:border-transparent disabled:text-gray-500
    border border-gray-700 focus-within:border-gray-600 hover:border-gray-600 pl-4
    text-gray-400 focus-within:text-gray-100 hover:text-gray-100 transition-all ease-out duration-150`}
    >
      <QuillIcon />
      <input
        className={`w-full p-4 pl-0 bg-transparent rounded-lg outline-none focus:outline-0 
        placeholder:text-current transition-all ease-out duration-150`}
        placeholder={placeholder}
        id={id}
        value={value}
        onChange={onChange}
        autoComplete="off"
        type="search"
      />
    </div>
  );
};

export default NLInput;
