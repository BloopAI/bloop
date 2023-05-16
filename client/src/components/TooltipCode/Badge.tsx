import Tooltip from '../Tooltip';
import { TokenInfoType } from '../../types/results';

type Props = {
  type: TokenInfoType;
  onClick: (type: TokenInfoType) => void;
  active?: boolean;
  disabled?: boolean;
  tooltipText: string;
};

const colorMap = {
  references: 'bg-bg-danger',
  definitions: 'bg-bg-success',
  mod: 'bg-violet',
  ret: 'bg-sky',
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
        className={`flex items-center justify-center gap-1 px-2 py-1 rounded-4 ${
          disabled || !active
            ? 'bg-transparent border border-bg-border'
            : 'bg-bg-base-hover'
        } ${disabled ? 'cursor-default' : 'cursor-pointer'} select-none`}
        onClick={() => onClick(type)}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            disabled || !active ? 'bg-label-muted' : colorMap[type]
          }`}
        />
        <span
          className={`uppercase caption ${
            disabled || !active ? 'text-label-muted' : 'text-label-title'
          }`}
        >
          {type.slice(0, 3)}
        </span>
      </div>
    </Tooltip>
  );
};

export default TooltipCodeBadge;
