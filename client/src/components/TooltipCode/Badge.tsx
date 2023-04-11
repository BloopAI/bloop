import Tooltip from '../Tooltip';
import { Type } from './index';

type Props = {
  type: Type;
  onClick: (type: Type) => void;
  active?: boolean;
  disabled?: boolean;
  tooltipText: string;
};

const colorMap = {
  ref: 'bg-danger-400',
  def: 'bg-success-400',
  mod: 'bg-violet-400',
  ret: 'bg-sky-500',
};

const TooltipCodeBadge = ({
  type,
  onClick,
  active,
  disabled,
  tooltipText,
}: Props) => {
  return (
    <Tooltip text={tooltipText} placement={'top'}>
      <div
        className={`flex items-center justify-center gap-1 px-2 py-1 rounded-4 border border-gray-600 ${
          disabled || !active ? 'bg-transparent' : 'bg-gray-600'
        } ${disabled ? 'cursor-default' : 'cursor-pointer'} select-none`}
        onClick={() => onClick(type)}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            disabled || !active ? 'bg-gray-500' : colorMap[type]
          }`}
        />
        <span
          className={`uppercase caption ${
            disabled || !active ? 'text-gray-500' : 'text-gray-50'
          }`}
        >
          {type}
        </span>
      </div>
    </Tooltip>
  );
};

export default TooltipCodeBadge;
