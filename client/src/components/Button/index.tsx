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
  variant?:
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'tertiary-outlined'
    | 'tertiary-active';
  size?: 'tiny' | 'small' | 'medium' | 'large';
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
    'text-label-control bg-bg-main hover:bg-bg-main-hover focus:bg-bg-main-hover active:bg-bg-main active:shadow-rings-blue disabled:bg-bg-base disabled:text-label-muted disabled:hover:border-none disabled:hover:bg-bg-base disabled:active:shadow-none disabled:border-none',
  secondary:
    'text-label-title bg-bg-base border border-bg-border hover:border-bg-border-hover hover:bg-bg-base-hover focus:border-bg-border-hover active:bg-bg-base disabled:bg-bg-base disabled:border-none disabled:text-label-muted shadow-low hover:shadow-none focus:shadow-none active:shadow-rings-gray disabled:shadow-none',
  tertiary:
    'text-label-muted bg-transparent hover:text-label-title focus:text-label-title hover:bg-bg-base-hover focus:bg-bg-base-hover active:text-label-title active:bg-transparent disabled:bg-bg-base disabled:text-label-muted',
  'tertiary-active': 'text-label-title bg-bg-base-hover',
  'tertiary-outlined':
    'text-label-muted bg-transparent border border-bg-border hover:bg-bg-base-hover focus:bg-bg-base-hover active:bg-transparent hover:text-label-title focus:text-label-title active:text-label-title disabled:bg-bg-base disabled:text-label-muted disabled:border-transparent disabled:hover:border-transparent',
};

const sizeMap = {
  tiny: {
    default: 'h-6 px-1 gap-1 caption-strong min-w-[64px] ',
    square: 'h-6 w-6 justify-center p-0',
  },
  small: {
    default: 'h-8 px-2 gap-1 caption-strong min-w-[70px]',
    square: 'h-8 w-8 justify-center p-0',
  },
  medium: {
    default: 'h-10 px-2.5 gap-2 callout min-w-[84px]',
    square: 'h-10 w-10 justify-center p-0',
  },
  large: {
    default: 'h-11.5 px-3.5 gap-2 callout min-w-[84px]',
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
      type = 'button',
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
          onlyIcon ? '' : 'justify-center'
        } transition-all duration-300 ease-in-bounce select-none`,
      [variant, className, size, onlyIcon],
    );
    return onlyIcon && !rest.disabled ? (
      <Tooltip text={title} placement={tooltipPlacement}>
        <button {...rest} type={type} ref={ref} className={buttonClassName}>
          {children}
        </button>
      </Tooltip>
    ) : (
      <button {...rest} type={type} ref={ref} className={buttonClassName}>
        {children}
      </button>
    );
  },
);

export default Button;
