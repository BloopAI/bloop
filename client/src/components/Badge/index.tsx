import { memo } from 'react';

type Props = {
  type?:
    | 'outlined'
    | 'filled'
    | 'green'
    | 'green-subtle'
    | 'red'
    | 'red-subtle'
    | 'yellow'
    | 'yellow-subtle'
    | 'blue'
    | 'blue-subtle'
    | 'studio';
  size?: 'large' | 'small' | 'mini';
  Icon?: (props: {
    raw?: boolean | undefined;
    sizeClassName?: string | undefined;
    className?: string | undefined;
  }) => JSX.Element;
  text: string;
};

const typeMap = {
  outlined: 'border border-bg-border text-label-base',
  filled: 'bg-bg-border text-label-base',
  green: 'bg-bg-green text-label-control',
  'green-subtle': 'bg-green-subtle text-green',
  red: 'bg-bg-red text-label-control',
  'red-subtle': 'bg-red-subtle text-red',
  yellow: 'bg-bg-yellow text-label-control',
  'yellow-subtle': 'bg-yellow-subtle text-yellow',
  blue: 'bg-bg-blue text-label-control',
  'blue-subtle': 'bg-blue-subtle text-blue',
  studio:
    'bg-[linear-gradient(110deg,#D92037_1.23%,#D9009D_77.32%)] text-label-control',
};

const sizeMap = {
  large: { pill: 'h-7 px-2.5 gap-1.5 body-s', icon: 'w-4 h-4' },
  small: { pill: 'h-6 px-2 gap-1 body-mini', icon: 'w-3.5 h-3.5' },
  mini: { pill: 'h-5 px-1.5 gap-1 body-tiny', icon: 'w-3 h-3' },
};

const Badge = ({ type = 'outlined', size = 'small', Icon, text }: Props) => {
  return (
    <div
      className={`inline-flex items-center flex-shrink-0 rounded-full ${typeMap[type]} ${sizeMap[size].pill}`}
    >
      {!!Icon && <Icon sizeClassName={sizeMap[size].icon} />}
      <p>{text}</p>
    </div>
  );
};

export default memo(Badge);
