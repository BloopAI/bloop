import { ButtonHTMLAttributes, DetailedHTMLProps, memo } from 'react';
import useShortcuts from '../../hooks/useShortcuts';

type Props = {
  text: string;
  shortcut: string[];
};

const KeyHintButton = ({
  text,
  shortcut,
  ...btnProps
}: DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> &
  Props) => {
  const keys = useShortcuts(shortcut);
  return (
    <button
      type="button"
      className={`flex items-center gap-1 h-7 p-1 pl-2 rounded-6 body-mini group
      bg-bg-base text-label-muted
      hover:bg-bg-base-hover hover:text-label-title
      transition-all ease-in-out duration-150
      outline-0 outline-none focus:outline-0 focus:outline-none`}
      {...btnProps}
    >
      <span>{text}</span>
      {keys?.map((k) => (
        <span
          key={k}
          className={`min-w-[1.25rem] h-5 flex items-center justify-center px-1 rounded 
          transition-all ease-in-out duration-150
          bg-bg-base-hover group-hover:bg-bg-border-hover body-mini text-label-base`}
        >
          {k}
        </span>
      ))}
    </button>
  );
};

export default memo(KeyHintButton);
