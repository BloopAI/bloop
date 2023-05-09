import React, { useContext, useEffect } from 'react';
import ListNavigation from '../IdeNavigation/ListNavigation';
import { Person, TuneControls } from '../../icons';
import { UIContext } from '../../context/uiContext';
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

const listNavigationItems = [
  { title: 'General', icon: <Person /> },
  { title: 'Preferences', icon: <TuneControls /> },
  // { title: 'Repositories', icon: <Repository /> },
];

const Settings = () => {
  const {
    setSettingsSection,
    settingsSection,
    isSettingsOpen,
    setSettingsOpen,
  } = useContext(UIContext);

  useEffect(() => {
    const action = isSettingsOpen ? 'add' : 'remove';
    document.body.classList[action]('overflow-hidden');
  }, [isSettingsOpen]);

  return (
    <div
      className={`fixed top-0 bottom-0 left-0 right-0 bg-gray-900 bg-opacity-75 z-40 ${
        isSettingsOpen
          ? 'visible bg-opacity-75 backdrop-blur-2'
          : 'invisible bg-opacity-0 backdrop-blur-0'
      }`}
      style={isSettingsOpen ? backdropFilterVisible : backdropFilterInvisible}
      onClick={() => {
        setSettingsOpen(false);
        setSettingsSection(SettingSections.GENERAL);
      }}
    >
      <div
        className={`bg-gray-900 border border-gray-700 rounded-lg shadow-medium w-[85vw] h-[77vh] xl:w-[78vw] xl:h-[70vh] max-w-5.5xl flex ${
          isSettingsOpen ? 'opacity-100' : 'opacity-0'
        } absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-800 py-3 w-64">
          <ListNavigation
            setSelected={setSettingsSection}
            items={listNavigationItems}
            selected={settingsSection}
            variant="light"
          />
        </div>
        <div className="p-8 flex-1 overflow-y-auto flex flex-col">
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

export default Settings;
