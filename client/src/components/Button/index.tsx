import {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  ReactNode,
  PropsWithChildren,
  forwardRef,
  useMemo,
} from 'react';
import { TippyProps } from '@tippyjs/react/headless';
import Tooltip from '../Tooltip';

type Props = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'tertiary-outlined';
  size?: 'small' | 'medium' | 'large';
  className?: string;
} & (OnlyIconProps | TextBtnProps);

type OnlyIconProps = {
  onlyIcon: true;
  title: string;
  tooltipPlacement?: TippyProps['placement'];
};

type TextBtnProps = {
  onlyIcon?: false;
  tooltipPlacement?: never;
};

const variantStylesMap = {
  primary:
    'text-gray-100 bg-primary-400 hover:bg-primary-300 focus:bg-primary-300 active:bg-primary-400 active:shadow-rings-blue disabled:bg-gray-800 disabled:text-gray-500 disabled:hover:border-none disabled:hover:bg-gray-800 disabled:active:shadow-none disabled:border-none',
  secondary:
    'text-gray-300 hover:text-gray-100 focus:text-gray-100 bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-gray-600 active:border-gray-700 active:text-gray-200 disabled:border-none disabled:text-gray-500 shadow-light hover:shadow-none focus:shadow-none active:shadow-light disabled:shadow-none',
  tertiary:
    'text-gray-500 bg-transparent hover:text-gray-300 focus:text-gray-300 hover:border-gray-800 focus:border-gray-800 active:text-gray-50 disabled:bg-gray-900 disabled:text-gray-500 disabled:hover:border-transparent',
  'tertiary-outlined':
    'text-gray-500 bg-transparent border border-gray-700 hover:bg-gray-700 focus:bg-gray-700 active:bg-transparent hover:text-gray-300  active:text-gray-50 disabled:bg-gray-900 disabled:text-gray-500 disabled:border-transparent disabled:hover:border-transparent',
};

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

// eslint-disable-next-line react/display-name
const Button = forwardRef<
  HTMLButtonElement,
  PropsWithChildren<
    DetailedHTMLProps<
      ButtonHTMLAttributes<HTMLButtonElement>,
      HTMLButtonElement
    > &
      Props
  >
>(
  (
    {
      children,
      variant = 'primary',
      size = 'medium',
      onlyIcon,
      className,
      title,
      tooltipPlacement,
      ...rest
    },
    ref,
  ) => {
    const buttonClassName = useMemo(
      () =>
        `py-0 rounded-4 focus:outline-none outline-none outline-0 flex items-center flex-grow-0 flex-shrink-0 ${
          variantStylesMap[variant]
        } ${onlyIcon ? sizeMap[size].square : sizeMap[size].default} ${
          className || ''
        } ${
          onlyIcon ? '' : 'min-w-[84px] justify-center'
        } transition-all duration-300 ease-in-bounce select-none`,
      [variant, className, size, onlyIcon],
    );
    return onlyIcon && !rest.disabled ? (
      <Tooltip text={title} placement={tooltipPlacement}>
        <button {...rest} ref={ref} className={buttonClassName}>
          {children}
        </button>
      </Tooltip>
    ) : (
      <button {...rest} ref={ref} className={buttonClassName}>
        {children}
      </button>
    );
  },
);

export default Button;
