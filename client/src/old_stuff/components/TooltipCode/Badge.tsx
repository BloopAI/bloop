import { Trans } from 'react-i18next';
import Tooltip from '../../../components/Tooltip';
import { TokenInfoType } from '../../../types/results';
import { Def, Ref } from '../../../icons';
import { TypeMap } from './index';

type Props = {
  type: TokenInfoType;
  onClick: (type: TokenInfoType) => void;
  active?: boolean;
  disabled?: boolean;
  tooltipText: string;
};

const colorMap = {
  reference: 'text-bg-danger',
  definition: 'text-bg-success',
  mod: 'text-violet',
  ret: 'text-sky',
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
        className={`flex items-center justify-center gap-1 px-2 py-1 rounded-4 border border-bg-border-hover ${
          disabled || !active
            ? 'bg-transparent border border-bg-border'
            : 'bg-bg-base-hover'
        } ${disabled ? 'cursor-default' : 'cursor-pointer'} select-none group`}
        onClick={() => onClick(type)}
      >
        <div
          className={`w-3.5 h-3.5 ${
            disabled || !active ? 'text-label-muted' : colorMap[type]
          }`}
        >
          {type === TypeMap.DEF ? (
            <Def raw sizeClassName="w-3.5 h-3.5" />
          ) : (
            <Ref raw sizeClassName="w-3.5 h-3.5" />
          )}
        </div>
        <span
          className={`capitalize caption-strong ${
            disabled || !active
              ? 'text-label-muted'
              : 'text-label-base group-hover:text-label-control'
          }`}
        >
          <Trans>{type}</Trans>
        </span>
      </div>
    </Tooltip>
  );
};

export default TooltipCodeBadge;
