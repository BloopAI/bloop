import React, { memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { UIContext } from '../context/uiContext';
import Header from '../components/Header';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { SettingSections } from '../old_stuff/components/Settings';
import SectionsNav from './SectionsNav';
import General from './General';
import Preferences from './Preferences';
import SubscriptionSettings from './Subscription';

type Props = {};

const Settings = ({}: Props) => {
  useTranslation();
  const { isSettingsOpen, setSettingsOpen, settingsSection } = useContext(
    UIContext.Settings,
  );

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSettingsOpen(false);
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent, !isSettingsOpen);

  return isSettingsOpen ? (
    <div className="fixed top-0 bottom-0 left-0 right-0 bg-bg-sub select-none z-40">
      <Header isSettings />
      <div className="mx-auto my-8 px-3 flex max-w-6xl items-start justify-start w-full gap-13">
        <SectionsNav />
        {settingsSection === SettingSections.GENERAL ? (
          <General />
        ) : settingsSection === SettingSections.PREFERENCES ? (
          <Preferences />
        ) : (
          <SubscriptionSettings />
        )}
        <div className="w-56 flex-1 hidden lg:block" />
      </div>
    </div>
  ) : null;
};

export default memo(Settings);
