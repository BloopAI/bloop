import {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  ReactNode,
  PropsWithChildren,
} from 'react';

type Props = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'small' | 'medium' | 'large';
  onlyIcon?: boolean;
  selected?: boolean;
  className?: string;
};

const defaultState =
  'text-gray-100 border border-transparent hover:border-gray-600 active:border-gray-600 focus:order-gray-600 drop-shadow-light hover:drop-shadow-none';
const selectedState =
  'text-sky-500 hover:text-sky-400 bg-gray-900 border border-transparent ';

const sizeMap = {
  small: {
    default: 'h-8 px-2 gap-1 caption-strong',
    square: 'h-8 w-8 justify-center p-0',
  },
  medium: {
    default: 'h-10 px-2.5 gap-2 callout',
    square: 'h-10 w-10 justify-center p-0',
  },
  large: {
    default: 'h-11.5 px-3.5 gap-2 callout',
    square: 'h-11.5 w-11.5 justify-center p-0',
  },
};

const Button = ({
  children,
  size = 'medium',
  onlyIcon,
  className,
  selected,
  ...rest
}: PropsWithChildren<
  DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > &
    Props
>) => {
  return (
    <button
      {...rest}
      className={`py-0 rounded-4 focus:outline-none outline-none outline-0 flex items-center flex-grow-0 flex-shrink-0 
       ${selected ? selectedState : defaultState}
       ${onlyIcon ? sizeMap[size].square : sizeMap[size].default} ${
        className || ''
      } ${
        onlyIcon ? '' : 'min-w-[84px] justify-center'
      } transition-all duration-300 ease-in-bounce`}
    >
      {children}
    </button>
  );
};

export default Button;
