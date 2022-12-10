import { ButtonHTMLAttributes, DetailedHTMLProps } from 'react';
import { CloseSign } from '../../icons';

const Button = ({
  className,
  ...props
}: DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>) => {
  return (
    <button
      {...props}
      type="button"
      className={`flex items-center justify-center outline-none outline-0 focus:outline-none w-5 mx-2.5 flex-shrink-0 ${
        className || ''
      } h-5 text-gray-100 p-0 border-none transition-all duration-300 ease-in-bounce bg-gray-700 hover:bg-gray-600 rounded-xl`}
    >
      <CloseSign sizeClassName="w-3.5 h-3.5" />
    </button>
  );
};

export default Button;
