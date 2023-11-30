import React, { memo, useCallback, useContext } from 'react';
import { UIContext } from '../../context/uiContext';
import { SettingSections } from '../../types/general';

type Props = {
  type: SettingSections;
  label: string;
};

const SectionButton = ({ type, label }: Props) => {
  const { settingsSection, setSettingsSection } = useContext(
    UIContext.Settings,
  );
  const onClick = useCallback(() => {
    setSettingsSection(type);
  }, [type]);
  return (
    <div className="w-full pl-4">
      <button
        onClick={onClick}
        className={`h-8 px-2 rounded-6 body-s-b flex items-center ${
          settingsSection === type
            ? 'bg-bg-shade text-label-title'
            : 'text-label-base'
        } w-full text-left`}
      >
        {label}
      </button>
    </div>
  );
};

export default memo(SectionButton);
