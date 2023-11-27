import { memo, ReactElement, useContext, useMemo } from 'react';
import { DeviceContext } from '../../../context/deviceContext';
import { CheckIcon } from '../../../icons';
import { mapShortcuts } from '../../../utils/keyboardUtils';
import useShortcuts from '../../../hooks/useShortcuts';

type Props = {
  icon?: ReactElement;
  label: string;
  shortcut?: string[];
  isSelected?: boolean;
  onClick: () => void;
};

const SectionItem = ({ icon, label, shortcut, onClick, isSelected }: Props) => {
  const shortcutKeys = useShortcuts(shortcut);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-6 h-8 flex items-center px-2 gap-2 text-label-muted bg-bg-shade 
        hover:text-label-title hover:bg-bg-shade-hover`}
    >
      {icon}
      <p className="flex-1 body-s text-label-title ellisis">{label}</p>
      <p className="body-mini text-label-muted">{shortcutKeys?.join(' ')}</p>
      {isSelected && (
        <CheckIcon
          sizeClassName="w-4 h-4"
          className="text-bg-border-selected"
        />
      )}
    </button>
  );
};

export default memo(SectionItem);
