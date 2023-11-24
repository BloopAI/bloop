import React, { memo, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ListNavigation from '../IdeNavigation/ListNavigation';
import { PersonIcon, TuneControls } from '../../../icons';
import { UIContext } from '../../../context/uiContext';
import General from './General';
import Preferences from './Preferences';

const backdropFilterVisible = {
  transition:
    'background-color 150ms linear 0s, backdrop-filter 150ms linear 0s',
};

const backdropFilterInvisible = {
  transition:
    'background-color 150ms linear 0s, visibility 0s linear 200ms, backdrop-filter 150ms linear 0ms',
};

export enum SettingSections {
  GENERAL,
  PREFERENCES,
  // REPOSITORIES,
}

const Settings = () => {
  const { t } = useTranslation();
  const { isSettingsOpen, setSettingsOpen } = useContext(UIContext.Settings);
  const [settingsSection, setSettingsSection] = useState(
    SettingSections.GENERAL,
  );

  const listNavigationItems = useMemo(
    () => [
      { title: t('General'), icon: <PersonIcon /> },
      { title: t('Preferences'), icon: <TuneControls /> },
      // { title: 'Repositories', icon: <Repository /> },
    ],
    [t],
  );

  return (
    <div
      className={`fixed top-0 bottom-0 left-0 right-0 z-90 ${
        isSettingsOpen
          ? 'visible bg-bg-base/75 backdrop-blur-2'
          : 'invisible bg-transparent backdrop-blur-0'
      }`}
      style={isSettingsOpen ? backdropFilterVisible : backdropFilterInvisible}
      onClick={() => {
        setSettingsOpen(false);
        setSettingsSection(SettingSections.GENERAL);
      }}
    >
      <div
        className={`bg-bg-shade border border-bg-border rounded-lg overflow-hidden shadow-medium w-[85vw] h-[77vh] xl:w-[78vw] xl:h-[70vh] max-w-5.5xl flex ${
          isSettingsOpen ? 'opacity-100' : 'opacity-0'
        } absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-3 w-64">
          <ListNavigation
            setSelected={setSettingsSection}
            items={listNavigationItems}
            selected={settingsSection}
            variant="light"
          />
        </div>
        <div className="p-8 flex-1 overflow-y-auto flex flex-col border-l border-bg-border">
          {settingsSection === SettingSections.GENERAL ? (
            <General />
          ) : (
            <Preferences />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(Settings);
