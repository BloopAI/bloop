import { useCallback, useContext, useState } from 'react';
import SettingsText from '../SettingsText';
import SettingsRow from '../SettingsRow';
import { AnalyticsContext } from '../../../context/analyticsContext';
import {
  IS_ANALYTICS_ALLOWED_KEY,
  savePlainToStorage,
} from '../../../services/storage';
import Button from '../../Button';
import SeparateOnboardingStep from '../../SeparateOnboardingStep';
import RemoteServicesStep, {
  STEP_KEY,
} from '../../../pages/Onboarding/RemoteServicesStep';
import { UIContext } from '../../../context/uiContext';
import GithubConnectStep from '../../../pages/Onboarding/GithubConnectStep';
import GithubReposStep from '../../../pages/Onboarding/GithubReposStep';
import Dropdown from '../../Dropdown/Normal';
import { MenuItemType } from '../../../types/general';
import { Theme } from '../../../types';

const themesMap = {
  default: 'Default',
  'default-light': 'Default Light',
  'vsc-default-dark': 'VSCode Dark',
  'vsc-default-light': 'VSCode Light',
  monokai: 'Monokai',
};

const Preferences = () => {
  const { isAnalyticsAllowed, setIsAnalyticsAllowed } =
    useContext(AnalyticsContext);
  const { isGithubConnected, setOnBoardingState, theme, setTheme } =
    useContext(UIContext);
  const [isModalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [hasOptedIn, setHasOptedIn] = useState(isAnalyticsAllowed);

  const saveOptIn = useCallback((optIn: boolean) => {
    savePlainToStorage(IS_ANALYTICS_ALLOWED_KEY, optIn ? 'true' : 'false');
    setOnBoardingState((prev) => ({
      ...prev,
      [STEP_KEY]: { hasOptedIn: optIn },
    }));
    setIsAnalyticsAllowed(optIn);
  }, []);

  return (
    <div className="w-full relative">
      <div className="mb-6">
        <h5>Preferences</h5>
      </div>
      <div>
        <SettingsRow>
          <SettingsText
            title="Theme"
            subtitle="Select your interface color scheme"
          />
          <Dropdown
            items={Object.entries(themesMap).map(([key, name]) => ({
              type: MenuItemType.DEFAULT,
              text: name,
              onClick: () => setTheme(key as Theme),
            }))}
            selected={{
              type: MenuItemType.DEFAULT,
              text: themesMap[theme],
            }}
          />
        </SettingsRow>
        <SettingsRow>
          <SettingsText
            title={`Remote services: ${isAnalyticsAllowed ? 'on' : 'off'}`}
            subtitle={`Natural language search is ${
              isAnalyticsAllowed ? 'enabled' : 'disabled'
            }`}
          />
          <div className="flex-1">
            <Button
              variant="secondary"
              onClick={() => {
                setModalOpen(true);
                setStep(0);
              }}
            >
              Change
            </Button>
          </div>
        </SettingsRow>
      </div>
      <SeparateOnboardingStep
        isVisible={isModalOpen}
        onClose={() => setModalOpen(false)}
      >
        {step === 0 ? (
          <RemoteServicesStep
            handleNext={() => {}}
            onSubmit={(optIn) => {
              setHasOptedIn(optIn);
              if (isGithubConnected || !optIn) {
                setModalOpen(false);
                saveOptIn(optIn);
              } else {
                setStep(1);
              }
            }}
          />
        ) : step === 1 ? (
          <GithubConnectStep
            handleNext={() => setStep(2)}
            forceAnalyticsAllowed={hasOptedIn}
          />
        ) : (
          <GithubReposStep
            handleNext={() => {
              setModalOpen(false);
              saveOptIn(hasOptedIn);
            }}
          />
        )}
      </SeparateOnboardingStep>
    </div>
  );
};

export default Preferences;
