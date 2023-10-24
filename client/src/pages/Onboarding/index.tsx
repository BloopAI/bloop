import React, { memo, useCallback, useContext } from 'react';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import {
  ONBOARDING_DONE_KEY,
  savePlainToStorage,
} from '../../services/storage';
import SelfServe from './SelfServe';
import Desktop from './Desktop';

export type Form = {
  firstName: string;
  lastName: string;
  email: string;
  emailError: string | null;
};

const Onboarding = ({ activeTab }: { activeTab: string }) => {
  const { shouldShowWelcome, setShouldShowWelcome } = useContext(
    UIContext.Onboarding,
  );
  const { isSelfServe } = useContext(DeviceContext);

  const closeOnboarding = useCallback(() => {
    setShouldShowWelcome(false);
    savePlainToStorage(ONBOARDING_DONE_KEY, 'true');
  }, []);

  return shouldShowWelcome ? (
    isSelfServe ? (
      <SelfServe
        activeTab={activeTab}
        closeOnboarding={closeOnboarding}
        setShouldShowWelcome={setShouldShowWelcome}
      />
    ) : (
      <Desktop
        activeTab={activeTab}
        closeOnboarding={closeOnboarding}
        setShouldShowWelcome={setShouldShowWelcome}
      />
    )
  ) : null;
};

export default memo(Onboarding);
