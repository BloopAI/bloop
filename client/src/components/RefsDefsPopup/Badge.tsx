import { Trans } from 'react-i18next';
import { useCallback } from 'react';
import Tooltip from '../Tooltip';
import { TokenInfoType } from '../../types/results';
import { DefIcon, RefIcon } from '../../icons';
import { TypeMap } from './index';

type Props = {
  type: TokenInfoType;
  onClick: (type: TokenInfoType) => void;
  active?: boolean;
  disabled?: boolean;
  tooltipText: string;
};

const colorMap = {
  reference: 'text-red',
  definition: 'text-green',
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
  const handleClick = useCallback(() => {
    if (!disabled) {
      onClick(type);
    }
  }, [disabled, type, onClick]);

  return (
    <Tooltip text={tooltipText} placement={'top'}>
      <div
        className={`flex items-center justify-center gap-1 px-1.5 h-6 rounded ${
          disabled || !active ? 'bg-transparent' : 'bg-bg-base-hover'
        } ${disabled ? 'cursor-default' : 'cursor-pointer'} select-none group`}
        onClick={handleClick}
      >
        {type === TypeMap.DEF ? (
          <DefIcon
            sizeClassName="w-3.5 h-3.5"
            className={disabled ? 'text-label-muted' : colorMap[type]}
          />
        ) : (
          <RefIcon
            sizeClassName="w-3.5 h-3.5"
            className={disabled ? 'text-label-muted' : colorMap[type]}
          />
        )}
        <span
          className={`capitalize body-mini-b ${
            disabled || !active ? 'text-label-muted' : 'text-label-title'
          }`}
        >
          <Trans>{type}</Trans>
        </span>
      </div>
    </Tooltip>
  );
};

export default TooltipCodeBadge;
