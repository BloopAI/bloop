import { ButtonHTMLAttributes, DetailedHTMLProps } from 'react';
import { CloseSignIcon } from '../../../icons';

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
      } h-5 text-label-title p-0 border-none transition-all duration-300 ease-in-bounce bg-bg-base hover:bg-bg-base-hover rounded-xl`}
    >
      <CloseSignIcon sizeClassName="w-3.5 h-3.5" />
    </button>
  );
};

export default Button;
