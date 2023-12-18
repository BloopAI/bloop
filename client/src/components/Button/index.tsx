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
    | 'brand-default'
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'tertiary-active'
    | 'ghost'
    | 'studio'
    | 'danger';
  size?: 'mini' | 'small' | 'medium' | 'large';
  className?: string;
} & (OnlyIconProps | TextBtnProps);

type OnlyIconProps = {
  onlyIcon: true;
  title: string;
  shortcut?: string[];
  tooltipPlacement?: TippyProps['placement'];
};

type TextBtnProps = {
  onlyIcon?: false;
  tooltipPlacement?: never;
  title?: string;
  shortcut?: string[];
};

const variantStylesMap = {
  'brand-default':
    'text-label-control border border-brand-default bg-brand-default shadow-low ' +
    'hover:bg-brand-default-hover ' +
    'focus:bg-brand-default-hover focus:shadow-rings-blue ' +
    'disabled:bg-bg-base disabled:border-none disabled:text-label-faint disabled:shadow-none ' +
    'disabled:hover:bg-bg-base',
  primary:
    'text-label-contrast border border-bg-contrast bg-bg-contrast shadow-low ' +
    'hover:bg-bg-contrast-hover hover:border-bg-contrast-hover ' +
    'disabled:bg-bg-base disabled:border-none disabled:text-label-faint disabled:shadow-none ' +
    'disabled:hover:bg-bg-base',
  secondary:
    'text-label-base border border-bg-border bg-bg-base shadow-low ' +
    'hover:text-label-title hover:bg-bg-base-hover hover:border-bg-border-hover ' +
    'disabled:text-label-faint disabled:shadow-none disabled:border-transparent' +
    'disabled:hover:text-label-faint disabled:hover:bg-bg-base disabled:hover:border-transparent',
  tertiary:
    'text-label-muted bg-transparent ' +
    'hover:text-label-title hover:bg-bg-base-hover ' +
    'disabled:text-label-faint ' +
    'disabled:hover:text-label-faint disabled:hover:bg-transparent',
  'tertiary-active':
    'text-label-title bg-bg-base-hover disabled:text-label-faint',
  danger:
    'text-red border border-bg-border bg-bg-base shadow-low ' +
    'hover:bg-bg-base-hover hover:border-bg-border-hover ' +
    'disabled:text-label-faint disabled:shadow-none disabled:bg-bg-base disabled:border-transparent' +
    'disabled:hover:text-label-faint disabled:hover:bg-bg-base disabled:hover:border-transparent',
  ghost:
    'text-label-muted bg-transparent ' +
    'hover:text-label-title ' +
    'disabled:text-label-faint ' +
    'disabled:hover:text-label-faint',
  studio:
    'text-label-control bg-brand-studio border border-brand-studio shadow-low ' +
    'hover:bg-brand-studio-hover ' +
    'disabled:text-label-faint disabled:bg-bg-base disabled:bg-transparent disabled:shadow-none' +
    'disabled:hover:bg-bg-base',
};

const sizeMap = {
  mini: {
    default: 'h-6 px-1.5 gap-1 body-mini-b rounded',
    square: 'h-6 w-6 rounded',
  },
  small: {
    default: 'h-7 px-2 gap-1 body-mini-b rounded',
    square: 'h-7 w-8 rounded',
  },
  medium: {
    default: 'h-8 px-2.5 gap-1.5 body-s-b rounded-6',
    square: 'h-8 w-10 rounded-6',
  },
  large: {
    default: 'h-9 px-3 gap-2 body-base-b rounded-6',
    square: 'h-9 w-9 rounded-6',
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
      shortcut,
      ...rest
    },
    ref,
  ) => {
    const buttonClassName = useMemo(
      () =>
        `py-0 focus:outline-none outline-none outline-0 flex items-center justify-center flex-grow-0 flex-shrink-0 ${
          variantStylesMap[variant]
        } ${onlyIcon ? sizeMap[size].square : sizeMap[size].default} ${
          className || ''
        } select-none transition-all duration-150 ease-in-out`,
      [variant, className, size, onlyIcon],
    );
    return (onlyIcon && !rest.disabled) || title ? (
      <Tooltip text={title} placement={tooltipPlacement} shortcut={shortcut}>
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
