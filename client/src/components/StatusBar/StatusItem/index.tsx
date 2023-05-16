import { ReactElement } from 'react';
import TextField from '../../TextField';

type Props = {
  icon: ReactElement;
  textMain: string;
  textSecondary: string;
  secondaryColor?: 'ok' | 'error';
};

const StatusItem = ({
  icon,
  textMain,
  textSecondary,
  secondaryColor,
}: Props) => {
  let secondaryColorClass = '';
  switch (secondaryColor) {
    case 'ok':
      secondaryColorClass = 'text-bg-success';
      break;
    case 'error':
      secondaryColorClass = 'text-bg-danger';
      break;
  }

  return (
    <span className="flex gap-1 items-center">
      <TextField value={textMain} icon={icon} />
      <span>·</span>
      <span className={secondaryColorClass}>
        <TextField value={textSecondary} />
      </span>
    </span>
  );
};

export default StatusItem;
